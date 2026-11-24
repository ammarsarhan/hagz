import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { CANCELLATION_PRESETS, playersOn } from "@hagz/contracts";
import { createBooking, joinGame, LIMITS, listBooking, newCode } from "@/modules/bookings";
import { createFirstAdmin } from "@/modules/identity";
import { settlePayment, startCheckout } from "@/modules/payments";
import { ALL_PERMISSIONS, reconcileGround, VENUE_LIVE } from "@/modules/venues";
import { env } from "@/platform/config/env";
import { hashPassword } from "@/platform/crypto/passwords";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { cache, queueConnection } from "@/platform/redis/connections";
import { createLocalDiskStorage } from "@/platform/storage/providers";
import { LOCAL_STORAGE_ROOT, storage } from "@/platform/storage/storage";
import { seedBookings } from "./seed-bookings";

// Development only: 50 live venues across Alexandria, enough to try every Search filter, every Home
// rail and open games (user, 2026-11-24). Run on an empty database after seed:reference:
//
//   pnpm --filter @hagz/server exec prisma migrate reset --force
//   pnpm --filter @hagz/server seed:reference
//   pnpm --filter @hagz/server seed:alexandria
//
// What it makes, and what each part is for:
// - Venues in every Alexandria area, of every kind: five-a-side, 5s and 7s, indoor futsal, covered
//   7s, full-size grass, padel, tennis, multi-sport; prices from 150 to 1,600 EGP an hour (Budget
//   is 250 and under); open late, all day or all night; instant or approved; paid at the venue, by
//   deposit or online; every cancellation preset; loyalty on some; amenities varied. Photos from
//   Pexels (free to use), downloaded once into .storage/seed-cache.
// - When each went live (Newest), and reviews from completed past games (Top rated, the rating
//   filter; some venues under the 5 reviews it needs).
// - Bookings through the real path over the next days (Most booked, fewer free times), some left
//   awaiting payment or approval to expire; a few slots marked freed lately (Just freed).
// - About 30 open games, hosted and joined through the real path, some full, some one short.
// - Accounts: an admin, the owner of every venue, a player with history (Play again with a usual
//   time, the next-game ticket, saved venues, a game joined) and a player with none (their first
//   booking gets the confetti). The pool of seed players fills the rest.

if (env.APP_ENV !== "development") {
  console.error(`Refusing to seed in ${env.APP_ENV}: this script is for local development only.`);
  process.exit(1);
}
if (storage.name !== "local-disk") {
  console.error("seed:alexandria writes photos to local disk storage; unset the STORAGE_* keys.");
  process.exit(1);
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TIMEZONE = "Africa/Cairo";

export const ACCOUNTS = {
  admin: { email: "admin@hagz.test", name: "Test Admin", password: "test-admin-password" },
  // The same owner as seed:nearby and seed:invitations.
  owner: { phone: "+201000000000", name: "Seed Owner", password: "seed-owner-password" },
  player: { phone: "+201000000001", name: "Test Player", password: "test-player-password" },
  newcomer: { phone: "+201000000002", name: "New Player", password: "test-player-password" },
};

// The pool: the first eight are seed:bookings' players (same phones), +20 100 000 0010 to 0039.
const PLAYER_NAMES = [
  "Omar Hassan",
  "Youssef Adel",
  "Mariam Fathy",
  "Karim Nabil",
  "Hana Mostafa",
  "Ziad Samir",
  "Salma Ibrahim",
  "Mahmoud Tarek",
  "Ahmed Gamal",
  "Nour El Din",
  "Mostafa Ashraf",
  "Laila Hesham",
  "Seif Khaled",
  "Farida Walid",
  "Hassan Reda",
  "Yassin Magdy",
  "Malak Sherif",
  "Amr Fawzy",
  "Tamer Lotfy",
  "Habiba Ayman",
  "Adham Wael",
  "Marwan Essam",
  "Jana Ehab",
  "Khaled Mounir",
  "Ali Soliman",
  "Rana Atef",
  "Mohamed Saad",
  "Islam Hamdy",
  "Yara Nasser",
  "Hazem Ragab",
];
const PLAYER_PASSWORD = "seed-player-password";

// mulberry32, from a fixed seed: the same database every time.
let state = 2026;
const random = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
};
const between = (from: number, to: number) => from + Math.floor(random() * (to - from + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
const chance = (p: number) => random() < p;
const shuffled = <T>(items: readonly T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
};
// Prices in whole pounds, to the nearest 25.
const egp = (pounds: number) => Math.round(pounds / 25) * 25 * 100;

// ── Photos ──────────────────────────────────────────────────────────────────────────────────────
// Pexels photo ids (pexels.com/photo/<id>, free to use), checked by eye on 2026-11-24.
const PHOTOS = {
  FOOTBALL: [
    13907456, 16826134, 399187, 186239, 27307529, 17264600, 33267122, 21365072, 16493254, 19436350,
    3846652, 17425774,
  ],
  PADEL: [32474981, 32897040, 34079475, 4536850, 33641987],
  TENNIS: [19872965, 6931243, 1784798, 9716299, 17945162],
} as const;
const CACHE = path.join(LOCAL_STORAGE_ROOT, "seed-cache");
const disk = createLocalDiskStorage(LOCAL_STORAGE_ROOT, `http://localhost:${env.PORT}`);
const run = promisify(execFile);

interface Photo {
  bytes: Buffer;
  preview: Buffer | null;
}
const photos = new Map<number, Photo>();
const photo = async (id: number): Promise<Photo> => {
  const known = photos.get(id);
  if (known) return known;
  await mkdir(CACHE, { recursive: true });
  const file = path.join(CACHE, `pexels-${id}.jpg`);
  const small = path.join(CACHE, `pexels-${id}-64.jpg`);
  const exists = await stat(file).then(
    () => true,
    () => false,
  );
  if (!exists) {
    const response = await fetch(
      `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`,
    );
    if (!response.ok) throw new Error(`Pexels photo ${id}: ${response.status}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  // The tiny preview the app makes before uploading (at most 4 KB): sips, on a Mac; none elsewhere.
  let preview: Buffer | null = null;
  if (process.platform === "darwin") {
    await run(
      "sips",
      ["-Z", "64", "-s", "format", "jpeg", "-s", "formatOptions", "40", file].concat([
        "--out",
        small,
      ]),
    ).catch(() => undefined);
    preview = await readFile(small).catch(() => null);
    if (preview && preview.length > 4096) preview = null;
  }
  const loaded = { bytes: await readFile(file), preview };
  photos.set(id, loaded);
  return loaded;
};

// ── Venues ──────────────────────────────────────────────────────────────────────────────────────
type Kind =
  | "five" // Five-a-side turf, outdoor.
  | "budget" // Cheap five-a-side.
  | "mix" // Fives and sevens.
  | "covered" // Covered sevens.
  | "futsal" // Indoor five-a-side on a hard court.
  | "full" // A full-size grass pitch and sevens.
  | "padel"
  | "tennis"
  | "multi"; // Football, padel and tennis.

type Area =
  "smouha" | "sidi-gaber" | "stanley" | "miami" | "seyouf" | "montaza" | "agami" | "borg-el-arab";

const VENUES: { en: string; ar: string; area: Area; kind: Kind }[] = [
  { en: "Smouha Sporting Pitches", ar: "ملاعب سموحة الرياضية", area: "smouha", kind: "mix" },
  { en: "Fawzy Moaz Five", ar: "خماسي فوزي معاذ", area: "smouha", kind: "five" },
  { en: "Victor Emmanuel Arena", ar: "ملعب فيكتور عمانويل", area: "smouha", kind: "covered" },
  { en: "Smouha Padel House", ar: "بيت البادل سموحة", area: "smouha", kind: "padel" },
  { en: "Green Plaza Turf", ar: "نجيل جرين بلازا", area: "smouha", kind: "budget" },
  { en: "Antoniadis Grounds", ar: "ملاعب أنطونيادس", area: "smouha", kind: "full" },
  { en: "Ali Ibn Abi Taleb Futsal", ar: "فوتسال علي بن أبي طالب", area: "smouha", kind: "futsal" },
  { en: "Smouha Tennis Garden", ar: "حديقة سموحة للتنس", area: "smouha", kind: "tennis" },
  { en: "Zahran Kickoff", ar: "زهران كيك أوف", area: "smouha", kind: "five" },
  { en: "Sidi Gaber Arena", ar: "ملعب سيدي جابر", area: "sidi-gaber", kind: "mix" },
  { en: "Sporting Night League", ar: "دوري سبورتنج الليلي", area: "sidi-gaber", kind: "five" },
  { en: "Mostafa Kamel Grounds", ar: "ملاعب مصطفى كامل", area: "sidi-gaber", kind: "multi" },
  { en: "Cleopatra Five-a-Side", ar: "كليوباترا خماسي", area: "sidi-gaber", kind: "budget" },
  { en: "Ibrahimia Padel", ar: "إبراهيمية بادل", area: "sidi-gaber", kind: "padel" },
  { en: "Camp Shezar Pitches", ar: "ملاعب كامب شيزار", area: "sidi-gaber", kind: "five" },
  { en: "Sidi Gaber Station Turf", ar: "نجيل محطة سيدي جابر", area: "sidi-gaber", kind: "covered" },
  { en: "Stanley Kickoff", ar: "ستانلي كيك أوف", area: "stanley", kind: "five" },
  { en: "Roushdy Turf", ar: "نجيل رشدي", area: "stanley", kind: "mix" },
  { en: "Kafr Abdo Courts", ar: "ملاعب كفر عبده", area: "stanley", kind: "padel" },
  { en: "Saba Pasha Futsal", ar: "فوتسال سابا باشا", area: "stanley", kind: "futsal" },
  { en: "Bolkly Arena", ar: "ملعب بولكلي", area: "stanley", kind: "budget" },
  { en: "Gleem Bay Five", ar: "خماسي خليج جليم", area: "stanley", kind: "five" },
  { en: "Miami Beach Five", ar: "خماسي شاطئ ميامي", area: "miami", kind: "five" },
  { en: "Asafra Sports Hub", ar: "مركز العصافرة الرياضي", area: "miami", kind: "multi" },
  { en: "Mandara Padel", ar: "المندرة بادل", area: "miami", kind: "padel" },
  { en: "Gamal Abdel Nasser Pitches", ar: "ملاعب جمال عبد الناصر", area: "miami", kind: "mix" },
  { en: "Miami Night Turf", ar: "نجيل ميامي الليلي", area: "miami", kind: "budget" },
  { en: "Sidi Bishr Arena", ar: "ملعب سيدي بشر", area: "miami", kind: "covered" },
  { en: "Asafra Tennis Club", ar: "نادي العصافرة للتنس", area: "miami", kind: "tennis" },
  { en: "Seyouf Grounds", ar: "ملاعب السيوف", area: "seyouf", kind: "full" },
  { en: "Seyouf Qebly Five", ar: "خماسي السيوف قبلي", area: "seyouf", kind: "budget" },
  { en: "Lotfy El Sayed Pitches", ar: "ملاعب لطفي السيد", area: "seyouf", kind: "five" },
  { en: "Seyouf Padel Point", ar: "سيوف بادل بوينت", area: "seyouf", kind: "padel" },
  { en: "El Nasr Futsal", ar: "فوتسال النصر", area: "seyouf", kind: "futsal" },
  { en: "Seyouf Bahary Arena", ar: "ملعب السيوف بحري", area: "seyouf", kind: "mix" },
  { en: "Montaza Gardens Pitches", ar: "ملاعب حدائق المنتزه", area: "montaza", kind: "mix" },
  { en: "Maamoura Padel", ar: "المعمورة بادل", area: "montaza", kind: "padel" },
  { en: "Abu Qir Arena", ar: "ملعب أبو قير", area: "montaza", kind: "five" },
  { en: "Montaza Tennis Courts", ar: "ملاعب المنتزه للتنس", area: "montaza", kind: "tennis" },
  { en: "Royal Palm Five", ar: "خماسي رويال بالم", area: "montaza", kind: "budget" },
  { en: "Montaza Night League", ar: "دوري المنتزه الليلي", area: "montaza", kind: "covered" },
  { en: "Agami Beach Turf", ar: "نجيل شاطئ العجمي", area: "agami", kind: "five" },
  { en: "Bitash Five", ar: "خماسي البيطاش", area: "agami", kind: "budget" },
  { en: "Hannoville Grounds", ar: "ملاعب الهانوفيل", area: "agami", kind: "full" },
  { en: "Agami Padel Club", ar: "نادي العجمي للبادل", area: "agami", kind: "padel" },
  { en: "Abu Talat Arena", ar: "ملعب أبو تلات", area: "agami", kind: "mix" },
  { en: "Dekheila Pitches", ar: "ملاعب الدخيلة", area: "agami", kind: "five" },
  { en: "New Borg Sports City", ar: "مدينة برج الرياضية", area: "borg-el-arab", kind: "multi" },
  { en: "Borg Five-a-Side", ar: "خماسي برج العرب", area: "borg-el-arab", kind: "budget" },
  { en: "Borg Padel & Tennis", ar: "برج بادل وتنس", area: "borg-el-arab", kind: "padel" },
];

const STREETS = [
  { en: "Fawzy Moaz St", ar: "شارع فوزي معاذ" },
  { en: "Abu Qir St", ar: "شارع أبو قير" },
  { en: "El Horreya Rd", ar: "طريق الحرية" },
  { en: "Mostafa Kamel St", ar: "شارع مصطفى كامل" },
  { en: "Gamal Abdel Nasser St", ar: "شارع جمال عبد الناصر" },
  { en: "Khaled Ibn El Walid St", ar: "شارع خالد بن الوليد" },
  { en: "El Geish Rd", ar: "طريق الجيش" },
  { en: "Lotfy El Sayed St", ar: "شارع لطفي السيد" },
  { en: "El Nokrashy St", ar: "شارع النقراشي" },
  { en: "Mahmoud Hamdy St", ar: "شارع محمود حمدي" },
];

const DESCRIPTIONS: Record<Kind, { en: string; ar: string }> = {
  five: {
    en: "Five-a-side pitches on fresh turf, floodlit until late. Bibs and balls at the desk.",
    ar: "ملاعب خماسي بنجيل جديد وإضاءة حتى وقت متأخر. الصديري والكور عند الاستقبال.",
  },
  budget: {
    en: "No-frills five-a-side at a fair price. Turn up, play, go home happy.",
    ar: "خماسي بسيط بسعر مناسب. تعال العب وارجع مبسوط.",
  },
  mix: {
    en: "Five and seven-a-side pitches side by side, so the whole group finds a game.",
    ar: "ملاعب خماسي وسباعي جنب بعض، عشان المجموعة كلها تلاقي ماتش.",
  },
  covered: {
    en: "Seven-a-side under a roof: no sun in the afternoon, no rain in winter.",
    ar: "سباعي تحت سقف: لا شمس بعد الظهر ولا مطر في الشتاء.",
  },
  futsal: {
    en: "Indoor futsal on a proper hard court, with seating for the ones waiting their turn.",
    ar: "فوتسال داخلي على أرضية صلبة، وأماكن للجلوس للمنتظرين.",
  },
  full: {
    en: "A full-size grass pitch for the big games, and sevens for everything else.",
    ar: "ملعب نجيل طبيعي كامل للماتشات الكبيرة، وسباعي لأي حاجة تانية.",
  },
  padel: {
    en: "Glass-walled padel courts with rackets to rent. Book an hour, bring three friends.",
    ar: "ملاعب بادل بحوائط زجاج ومضارب للإيجار. احجز ساعة وهات تلاتة أصحاب.",
  },
  tennis: {
    en: "Quiet courts with good light, kept swept and lined. Coaching on request.",
    ar: "ملاعب هادئة بإضاءة جيدة ونظيفة دائمًا. تدريب عند الطلب.",
  },
  multi: {
    en: "Football, padel and tennis in one place, with a café to wait in.",
    ar: "كرة قدم وبادل وتنس في مكان واحد، مع كافيتريا للانتظار.",
  },
};

type Sport = "FOOTBALL" | "PADEL" | "TENNIS";
type Size = "FIVE_A_SIDE" | "SEVEN_A_SIDE" | "ELEVEN_A_SIDE" | "STANDARD";
type Surface = "ARTIFICIAL_TURF" | "NATURAL_GRASS" | "HARD_COURT" | "CLAY";
type Setting = "INDOOR" | "OUTDOOR" | "COVERED";
interface Plan {
  sport: Sport;
  size: Size;
  surface: Surface;
  environment: Setting;
  base: number; // EGP an hour
}

const groundsFor = (kind: Kind): Plan[] => {
  const turf = (size: Size, base: number, environment: Setting = "OUTDOOR"): Plan => ({
    sport: "FOOTBALL",
    size,
    surface: "ARTIFICIAL_TURF",
    environment,
    base,
  });
  const many = (n: number, plan: () => Plan) => Array.from({ length: n }, plan);
  switch (kind) {
    case "five": {
      const base = between(12, 18) * 25;
      return many(between(2, 4), () => turf("FIVE_A_SIDE", base));
    }
    case "budget": {
      const base = between(6, 9) * 25;
      return many(between(1, 2), () => turf("FIVE_A_SIDE", base));
    }
    case "mix": {
      const five = between(14, 18) * 25;
      return [
        ...many(2, () => turf("FIVE_A_SIDE", five)),
        ...many(between(1, 2), () => turf("SEVEN_A_SIDE", five + 200)),
      ];
    }
    case "covered": {
      const seven = between(24, 32) * 25;
      return [
        ...many(between(1, 2), () => turf("SEVEN_A_SIDE", seven, "COVERED")),
        ...(chance(0.5) ? [turf("FIVE_A_SIDE", seven - 250, "COVERED")] : []),
      ];
    }
    case "futsal": {
      const base = between(16, 22) * 25;
      return many(between(1, 2), () => ({
        sport: "FOOTBALL",
        size: "FIVE_A_SIDE",
        surface: "HARD_COURT",
        environment: "INDOOR",
        base,
      }));
    }
    case "full":
      return [
        {
          sport: "FOOTBALL",
          size: "ELEVEN_A_SIDE",
          surface: "NATURAL_GRASS",
          environment: "OUTDOOR",
          base: between(48, 64) * 25,
        },
        ...many(between(1, 2), () => turf("SEVEN_A_SIDE", between(24, 30) * 25)),
      ];
    case "padel": {
      const base = between(12, 24) * 25;
      const environment = pick<Setting>(["INDOOR", "COVERED", "OUTDOOR"]);
      return many(between(2, 5), () => ({
        sport: "PADEL",
        size: "STANDARD",
        surface: "ARTIFICIAL_TURF",
        environment,
        base,
      }));
    }
    case "tennis": {
      const surface = pick<Surface>(["CLAY", "HARD_COURT"]);
      const base = between(6, 12) * 25;
      return many(between(2, 4), () => ({
        sport: "TENNIS",
        size: "STANDARD",
        surface,
        environment: "OUTDOOR",
        base,
      }));
    }
    case "multi":
      return [
        ...many(2, () => turf("FIVE_A_SIDE", between(14, 16) * 25)),
        ...many(2, () => ({
          sport: "PADEL" as const,
          size: "STANDARD" as const,
          surface: "ARTIFICIAL_TURF" as const,
          environment: "COVERED" as const,
          base: between(14, 18) * 25,
        })),
        {
          sport: "TENNIS",
          size: "STANDARD",
          surface: "HARD_COURT",
          environment: "OUTDOOR",
          base: between(8, 10) * 25,
        },
      ];
  }
};

// Opening hours, as the schedule's day rows (dayOfWeek 0 = Sunday); hours past midnight go in the
// next day's row. Peak 7–11 pm, and from 5 pm to midnight on Friday and Saturday.
type Hours = "late" | "day" | "allNight" | "early";
const HOURS: Record<Hours, number[]> = {
  late: [0, 1, ...range(16, 24)], // 4 pm to 2 am
  day: range(8, 24), // 8 am to midnight
  allNight: range(0, 24),
  early: range(7, 23), // 7 am to 11 pm
};
function range(from: number, to: number) {
  return Array.from({ length: to - from }, (_, i) => from + i);
}
const weekOf = (hours: Hours) =>
  Array.from({ length: 7 }, (_, dayOfWeek) => {
    const weekend = dayOfWeek === 5 || dayOfWeek === 6;
    const tiers: Record<string, "BASE" | "PEAK"> = {};
    for (const hour of HOURS[hours]) {
      tiers[String(hour)] = (weekend ? hour >= 17 : hour >= 19 && hour < 23) ? "PEAK" : "BASE";
    }
    return { dayOfWeek, hours: tiers };
  });

const coverOf = (plans: Plan[]): Sport => plans[0]?.sport ?? "FOOTBALL";

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────
const localHour = (at: Date) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(at),
  );

const pay = async (customerId: string, bookingId: string) => {
  const { checkout } = await startCheckout(
    customerId,
    bookingId,
    { method: "CARD" },
    crypto.randomUUID(),
  );
  await settlePayment(checkout.payment.id, "SUCCEEDED");
};

// A booking through the real path, paid when the venue wants money online; null when it couldn't
// be made (taken, inside the notice).
const book = async (customerId: string, groundId: string, startsAt: Date, endsAt: Date) => {
  try {
    const { value: bookingId } = await createBooking(
      customerId,
      {
        groundId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        amenities: [],
      },
      crypto.randomUUID(),
    );
    const { status } = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true },
    });
    if (status === "HELD") await pay(customerId, bookingId);
    return bookingId;
  } catch (error) {
    if (error instanceof AppError) return null;
    throw error;
  }
};

interface SeededGround {
  id: string;
  venueId: string;
  plan: Plan;
  peak: number;
}

// A played game, written straight in: slots only exist from today on, so the real path can't book
// the past. Charged as the booking would have been (slots at their tier, the service fee).
const usedPast = new Set<string>();
let checkedInBy = "";
const pastBooking = async (
  customerId: string,
  ground: SeededGround,
  startsAt: Date,
  hours: number,
  venue: {
    paymentMode: "MANUAL" | "DEPOSIT" | "PLATFORM";
    policy: keyof typeof CANCELLATION_PRESETS;
  },
  serviceFee: number,
) => {
  const key = `${ground.id}:${startsAt.getTime()}`;
  if (usedPast.has(key)) return null;
  for (let h = 0; h < hours; h++) usedPast.add(`${ground.id}:${startsAt.getTime() + h * HOUR}`);
  const account = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { name: true, phone: true },
  });
  const endsAt = new Date(startsAt.getTime() + hours * HOUR);
  const visitor = await prisma.venueCustomer.upsert({
    where: { venueId_customerId: { venueId: ground.venueId, customerId } },
    update: {
      bookingCount: { increment: 1 },
      lastBookedAt: startsAt,
    },
    create: {
      venueId: ground.venueId,
      customerId,
      name: account.name,
      phone: account.phone,
      bookingCount: 1,
      lastBookedAt: startsAt,
    },
    select: { id: true },
  });
  const slots = Array.from({ length: hours }, (_, h) => {
    const at = new Date(startsAt.getTime() + h * HOUR);
    const hour = localHour(at);
    const peak = hour >= 19 && hour < 23;
    return {
      at,
      tier: peak ? ("PEAK" as const) : ("BASE" as const),
      amount: peak ? ground.peak : ground.plan.base * 100,
    };
  });
  const fee = playersOn(ground.plan.sport, ground.plan.size) * hours * serviceFee;
  const total = slots.reduce((sum, slot) => sum + slot.amount, 0) + fee;
  const booking = await prisma.booking.create({
    data: {
      venueId: ground.venueId,
      groundId: ground.id,
      customerId: visitor.id,
      code: newCode(),
      status: "COMPLETED",
      startsAt,
      endsAt,
      total,
      depositAmount: venue.paymentMode === "DEPOSIT" ? Math.round(total / 2) : null,
      paymentMode: venue.paymentMode,
      commissionRate: 0,
      cancellationPolicy: venue.policy,
      cancellationTiers: CANCELLATION_PRESETS[venue.policy],
      // Checked in at kick-off; a check-in is always by staff, so by the owner.
      checkedInAt: startsAt,
      checkedInById: checkedInBy,
      createdAt: new Date(startsAt.getTime() - between(2, 72) * HOUR),
      charges: {
        create: [
          ...slots.map((slot) => ({
            type: "SLOT" as const,
            startsAt: slot.at,
            tier: slot.tier,
            amount: slot.amount,
            taxRate: 0,
            taxAmount: 0,
          })),
          ...(fee > 0
            ? [{ type: "SERVICE_FEE" as const, amount: fee, taxRate: 0, taxAmount: 0 }]
            : []),
        ],
      },
    },
    select: { id: true },
  });
  return { bookingId: booking.id, venueCustomerId: visitor.id };
};

const REVIEWS = {
  high: [
    {
      en: "Best turf in Alexandria, lights are great at night.",
      ar: "أحسن نجيل في إسكندرية، والإضاءة ممتازة بالليل.",
    },
    {
      en: "Clean, on time, and the staff were friendly.",
      ar: "نضيف ومواعيده مظبوطة والناس محترمة.",
    },
    {
      en: "We play here every week. Never had a problem.",
      ar: "بنلعب هنا كل أسبوع ومفيش أي مشكلة.",
    },
    { en: "Great courts and easy parking.", ar: "ملاعب ممتازة والركنة سهلة." },
  ],
  mid: [
    {
      en: "Good pitch, changing rooms could be cleaner.",
      ar: "الملعب كويس بس غرف الغيار محتاجة نضافة.",
    },
    {
      en: "Fine for the price. Started ten minutes late.",
      ar: "كويس بالنسبة للسعر. بدأنا متأخر عشر دقايق.",
    },
    { en: "Decent, but busy on weekends.", ar: "معقول، بس زحمة في الويك إند." },
  ],
  low: [
    { en: "Turf is worn out near the goals.", ar: "النجيل متآكل عند الجول." },
    { en: "Lights went off twice during our game.", ar: "النور قطع مرتين واحنا بنلعب." },
  ],
};

// ── Run ─────────────────────────────────────────────────────────────────────────────────────────
try {
  if ((await prisma.venue.count()) > 0) {
    throw new Error(
      "There are venues already: seed:alexandria fills an empty database (prisma migrate reset, then seed:reference).",
    );
  }
  const marketplace = await prisma.marketplace.findUnique({ where: { code: "EG" } });
  if (!marketplace) throw new Error("No EG marketplace: run seed:reference first.");
  // Seed players can have as many games and pay-at-venue bookings as this run needs; the server
  // keeps its own limits for everyone signing in.
  Object.assign(LIMITS, { payAtVenue: 1000, joined: 1000, hosted: 1000 });

  console.log("Accounts…");
  const admin = await createFirstAdmin(ACCOUNTS.admin);
  const owner = await prisma.staff.create({
    data: {
      name: ACCOUNTS.owner.name,
      phone: ACCOUNTS.owner.phone,
      passwordHash: await hashPassword(ACCOUNTS.owner.password),
      phoneVerifiedAt: new Date(),
    },
  });
  const customer = async (name: string, phone: string, password: string) =>
    prisma.customer.create({
      data: {
        name,
        phone,
        passwordHash: await hashPassword(password),
        phoneVerifiedAt: new Date(),
        language: "EN",
        timezone: TIMEZONE,
      },
      select: { id: true },
    });
  checkedInBy = owner.id;
  const me = await customer(ACCOUNTS.player.name, ACCOUNTS.player.phone, ACCOUNTS.player.password);
  await customer(ACCOUNTS.newcomer.name, ACCOUNTS.newcomer.phone, ACCOUNTS.newcomer.password);
  const players: { id: string }[] = [];
  for (const [i, name] of PLAYER_NAMES.entries()) {
    players.push(await customer(name, `+2010000000${String(10 + i)}`, PLAYER_PASSWORD));
  }

  const areas = await prisma.$queryRaw<
    { id: string; slug: Area; en: string; ar: string; lat: number; lng: number }[]
  >`
    SELECT l.id, l.slug, en.name AS en, ar.name AS ar,
           ST_Y(l.center::geometry) AS lat, ST_X(l.center::geometry) AS lng
    FROM "Location" l
    JOIN "Location" p ON p.id = l."parentId"
    JOIN "LocationTranslation" en ON en."locationId" = l.id AND en.language = 'EN'
    JOIN "LocationTranslation" ar ON ar."locationId" = l.id AND ar.language = 'AR'
    WHERE p.slug = 'alexandria' AND l."marketplaceId" = ${marketplace.id}::uuid`;
  const areaOf = new Map(areas.map((area) => [area.slug, area]));
  const amenities = await prisma.amenityOption.findMany({
    where: { marketplaceId: marketplace.id, isActive: true },
    select: { id: true, key: true },
  });

  console.log("Venues…");
  const venues: {
    id: string;
    name: string;
    kind: Kind;
    autoConfirm: boolean;
    paymentMode: "MANUAL" | "DEPOSIT" | "PLATFORM";
    policy: keyof typeof CANCELLATION_PRESETS;
    grounds: SeededGround[];
  }[] = [];
  for (const [i, spec] of VENUES.entries()) {
    const area = areaOf.get(spec.area);
    if (!area) throw new Error(`No area ${spec.area}: run seed:reference first.`);
    // Inland of the area's centre: Alexandria's coast runs south-west to north-east, so south-east
    // of it is land. 0.3 to 1.4 km away.
    const bearing = (between(105, 165) * Math.PI) / 180;
    const km = 0.3 + random() * 1.1;
    const latitude = area.lat + (km / 111.32) * Math.cos(bearing);
    const longitude =
      area.lng + (km / (111.32 * Math.cos((area.lat * Math.PI) / 180))) * Math.sin(bearing);

    const plans = groundsFor(spec.kind);
    const hours: Hours =
      spec.kind === "tennis"
        ? "early"
        : spec.kind === "padel"
          ? pick(["day", "late", "allNight"])
          : pick(["late", "late", "day", "allNight", "early"]);
    const autoConfirm = chance(0.75);
    const paymentRoll = random();
    const paymentMode = paymentRoll < 0.45 ? "MANUAL" : paymentRoll < 0.8 ? "DEPOSIT" : "PLATFORM";
    const policy = pick(["FLEXIBLE", "MODERATE", "STRICT"] as const);
    const loyalty = chance(0.4);
    const discountHours = chance(0.3) ? pick([3, 6]) : null;
    const street = pick(STREETS);
    const number = between(3, 140);
    // Live from about a year ago to yesterday; a few in the last two weeks (Newest).
    const liveDaysAgo = i % 7 === 3 ? between(1, 14) : between(20, 400);
    const liveAt = new Date(Date.now() - liveDaysAgo * DAY - between(0, 20) * HOUR);

    const venue = await prisma.venue.create({
      data: {
        marketplaceId: marketplace.id,
        locationId: area.id,
        slug: spec.en
          .toLowerCase()
          .replace(/&/g, "and")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
        status: "LIVE",
        phone: `+2010000001${String(i).padStart(2, "0")}`,
        createdAt: new Date(liveAt.getTime() - between(2, 10) * DAY),
        translations: {
          create: [
            {
              language: "EN",
              name: spec.en,
              description: DESCRIPTIONS[spec.kind].en,
              address: `${number} ${street.en}, ${area.en}, Alexandria`,
            },
            {
              language: "AR",
              name: spec.ar,
              description: DESCRIPTIONS[spec.kind].ar,
              address: `${number} ${street.ar}، ${area.ar}، الإسكندرية`,
            },
          ],
        },
        settings: {
          create: {
            defaultPermissions: { ...ALL_PERMISSIONS, finance: "none", venue: "view" },
            minimumNotice: pick([0, 30, 60, 60, 120]),
            autoConfirm,
            paymentMode,
            depositPercent: paymentMode === "DEPOSIT" ? pick([30, 50]) : null,
            cancellationPolicy: policy,
            freedDiscountHours: discountHours,
            ...(loyalty ? { loyaltyStamps: pick([5, 6, 10]), loyaltyWindow: pick([60, 90]) } : {}),
          },
        },
        memberships: { create: { staffId: owner.id, role: "OWNER", permissions: ALL_PERMISSIONS } },
        events: {
          create: { type: VENUE_LIVE, adminId: admin.id, data: {}, createdAt: liveAt },
        },
      },
      select: { id: true },
    });
    await prisma.$executeRaw`
      UPDATE "Venue"
      SET coordinates = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      WHERE id = ${venue.id}::uuid`;

    const football = plans.some((plan) => plan.sport === "FOOTBALL");
    const outdoor = plans.some((plan) => plan.environment === "OUTDOOR");
    const odds: Record<string, number> = {
      floodlights: outdoor ? 0.95 : 0.3,
      parking: 0.6,
      changing_rooms: 0.7,
      showers: 0.4,
      cafe: 0.5,
      ball_rental: football ? 0.55 : 0,
    };
    await prisma.venueAmenity.createMany({
      data: amenities
        .filter((option) => chance(odds[option.key] ?? 0.4))
        .map((option) => ({
          venueId: venue.id,
          optionId: option.id,
          marketplaceId: marketplace.id,
        })),
    });

    // Three to five photos, the cover of the venue's main sport, then its other sports.
    const sports = [...new Set(plans.map((plan) => plan.sport))];
    const ids = shuffled(PHOTOS[coverOf(plans)]).slice(0, between(2, 4));
    for (const sport of sports.slice(1)) ids.push(pick(PHOTOS[sport]));
    for (const [position, id] of ids.entries()) {
      const image = await photo(id);
      const key = `venues/${venue.id}/${crypto.randomUUID()}.jpg`;
      await disk.write(key, image.bytes, "image/jpeg");
      await prisma.venueMedia.create({
        data: {
          venueId: venue.id,
          key,
          type: "IMAGE",
          contentType: "image/jpeg",
          size: image.bytes.length,
          status: "READY",
          position,
          preview: image.preview ? new Uint8Array(image.preview) : null,
        },
      });
    }

    const grounds: SeededGround[] = [];
    const week = weekOf(hours);
    for (const [position, plan] of plans.entries()) {
      const peak = Math.round(plan.base * (1.2 + random() * 0.15));
      const kindName = plan.sport === "FOOTBALL" ? "Pitch" : "Court";
      const ground = await prisma.ground.create({
        data: {
          venueId: venue.id,
          sport: plan.sport,
          size: plan.size,
          surface: plan.surface,
          environment: plan.environment,
          position,
          basePrice: egp(plan.base),
          peakPrice: egp(peak),
          discountPrice: discountHours ? egp(plan.base * 0.7) : null,
          translations: {
            create: [
              { language: "EN", name: `${kindName} ${position + 1}` },
              { language: "AR", name: `ملعب ${position + 1}` },
            ],
          },
          settings: {
            create: {
              scheduleVersion: 1,
              minimumSlots: plan.size === "ELEVEN_A_SIDE" ? 2 : 1,
              maximumSlots: 3,
            },
          },
          schedules: { create: week },
        },
        select: { id: true },
      });
      await reconcileGround(ground.id);
      grounds.push({
        id: ground.id,
        venueId: venue.id,
        plan: { ...plan, base: egp(plan.base) / 100 },
        peak: egp(peak),
      });
    }
    venues.push({
      id: venue.id,
      name: spec.en,
      kind: spec.kind,
      autoConfirm,
      paymentMode,
      policy,
      grounds,
    });
    console.log(
      `  ${String(i + 1).padStart(2)} ${spec.en} · ${area.en} · ${plans.length} grounds · ${hours}`,
    );
  }

  console.log("Reviews from past games…");
  const pastStart = (daysAgo: number, hour: number) => {
    // That hour on that day, Cairo time. Egypt has summer time, so the offset comes from the zone.
    const day = new Date(Date.now() - daysAgo * DAY);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(day);
    const guess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
    return new Date(guess.getTime() - (localHour(guess) - hour) * HOUR);
  };
  for (const venue of venues) {
    // None, a few (under the 5 the rating filter needs), or many; each venue's own mean.
    const count = pick([0, 2, 3, 6, 9, 12, 15, 20, 25, 28]);
    const mean = 3.2 + random() * 1.75;
    const ratings: number[] = [];
    for (const player of shuffled(players).slice(0, count)) {
      const ground = pick(venue.grounds);
      const played = await pastBooking(
        player.id,
        ground,
        pastStart(between(1, 120), between(17, 22)),
        1,
        venue,
        marketplace.serviceFee,
      );
      if (!played) continue;
      const rating = Math.min(5, Math.max(1, Math.round(mean + (random() - 0.5) * 2)));
      const words = rating >= 4 ? REVIEWS.high : rating === 3 ? REVIEWS.mid : REVIEWS.low;
      const arabic = chance(0.5);
      const comment = chance(0.6) ? pick(words) : null;
      await prisma.venueReview.create({
        data: {
          customerId: played.venueCustomerId,
          venueId: venue.id,
          bookingId: played.bookingId,
          rating,
          comment: comment ? (arabic ? comment.ar : comment.en) : null,
          language: comment ? (arabic ? "AR" : "EN") : null,
        },
      });
      ratings.push(rating);
    }
    if (ratings.length > 0) {
      await prisma.venue.update({
        where: { id: venue.id },
        data: {
          averageRating: (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2),
          reviewCount: ratings.length,
        },
      });
    }
  }

  console.log("Test Player's history…");
  // Played at three venues: Tuesdays at 9 pm at the first (a usual time), twice at the second,
  // once at the third. Saved six venues, the first three among them.
  const football = venues.filter((venue) => venue.grounds.some((g) => g.plan.sport === "FOOTBALL"));
  const [regular, second, third] = football;
  if (!regular || !second || !third) throw new Error("Too few football venues.");
  // Days back to the Tuesday `weeks` weeks ago (1: the last one before today), on Cairo's calendar.
  const tuesdaysAgo = (weeks: number) => {
    const today = new Date(
      new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date()),
    );
    return ((today.getUTCDay() - 2 + 7) % 7 || 7) + (weeks - 1) * 7;
  };
  for (const weeks of [1, 2, 3, 5]) {
    const ground = regular.grounds[0];
    if (ground)
      await pastBooking(
        me.id,
        ground,
        pastStart(tuesdaysAgo(weeks), 21),
        1,
        regular,
        marketplace.serviceFee,
      );
  }
  for (const daysAgo of [9, 23]) {
    const ground = second.grounds[0];
    if (ground)
      await pastBooking(me.id, ground, pastStart(daysAgo, 19), 2, second, marketplace.serviceFee);
  }
  if (third.grounds[0])
    await pastBooking(me.id, third.grounds[0], pastStart(40, 20), 1, third, marketplace.serviceFee);
  for (const venue of [regular, second, third, ...shuffled(venues.slice(10)).slice(0, 3)]) {
    await prisma.venueFavorite.create({ data: { customerId: me.id, venueId: venue.id } });
  }

  // Free times on a ground from an hour from now to `days` out, at evening hours.
  const freeSlots = async (groundId: string, days: number) =>
    (
      await prisma.groundSlot.findMany({
        where: {
          groundId,
          status: "AVAILABLE",
          startsAt: { gte: new Date(Date.now() + 3 * HOUR), lt: new Date(Date.now() + days * DAY) },
        },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true, endsAt: true },
      })
    ).filter((slot) => {
      const hour = localHour(slot.startsAt);
      return hour >= 17 && hour <= 23;
    });

  // Their next game: tomorrow evening at a venue that confirms at once.
  const next = venues.find(
    (venue) =>
      venue.autoConfirm &&
      venue !== regular &&
      venue.grounds.some((g) => g.plan.sport === "FOOTBALL"),
  );
  if (next?.grounds[0]) {
    const slots = (await freeSlots(next.grounds[0].id, 2)).filter(
      (slot) => slot.startsAt.getTime() > Date.now() + 18 * HOUR,
    );
    const slot = slots.find((s) => localHour(s.startsAt) === 21) ?? slots[0];
    if (slot) await book(me.id, next.grounds[0].id, slot.startsAt, slot.endsAt);
  }

  console.log("Open games…");
  const gameVenues = venues.filter((venue) => venue.autoConfirm);
  const NOTES = [
    "Friendly game, all levels welcome",
    "Intermediate level, no slide tackles",
    "We need a goalkeeper!",
    "Bring a dark and a white shirt",
    "Regular group, looking for two more",
    undefined,
  ];
  let games = 0;
  let joinedByMe = false;
  for (let attempt = 0; games < 30 && attempt < 120; attempt++) {
    const venue = pick(gameVenues);
    const playable = venue.grounds.filter(
      (g) => g.plan.sport !== "TENNIS" && g.plan.size !== "ELEVEN_A_SIDE",
    );
    if (playable.length === 0) continue;
    const ground = pick(playable);
    const slots = await freeSlots(ground.id, 5);
    const slot = slots.length ? pick(slots) : undefined;
    if (!slot) continue;
    const [host, ...others] = shuffled(players);
    if (!host) continue;
    const length = ground.plan.sport === "PADEL" ? 1 : pick([1, 1, 2]);
    const startsAt = slot.startsAt;
    const endsAt = new Date(startsAt.getTime() + length * HOUR);
    const bookingId = await book(host.id, ground.id, startsAt, endsAt);
    if (!bookingId) continue;
    const { status } = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true },
    });
    if (status !== "CONFIRMED") continue;
    const cap = playersOn(ground.plan.sport, ground.plan.size) - 1;
    const needed =
      ground.plan.sport === "PADEL" ? between(1, 3) : pick([2, 3, 4, 5, Math.min(9, cap)]);
    try {
      await listBooking(host.id, bookingId, { neededPlayers: needed, note: pick(NOTES) });
    } catch (error) {
      if (error instanceof AppError) continue;
      throw error;
    }
    const listing = await prisma.bookingListing.findUniqueOrThrow({
      where: { bookingId_venueId: { bookingId, venueId: venue.id } },
      select: { id: true },
    });
    // A quarter full, a quarter one short, the rest anywhere in between.
    const roll = random();
    const joining = roll < 0.25 ? needed : roll < 0.5 ? needed - 1 : between(0, needed - 1);
    let joined = 0;
    for (const player of others) {
      if (joined >= joining) break;
      try {
        await joinGame(player.id, listing.id);
        joined++;
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
      }
    }
    // Test Player joins one that still has room.
    if (!joinedByMe && joined < needed) {
      try {
        await joinGame(me.id, listing.id);
        joinedByMe = true;
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
      }
    }
    games++;
    console.log(`  ${venue.name} · ${joined} of ${needed} joined`);
  }

  console.log("Bookings over the next days…");
  for (const [i, venue] of venues.entries()) {
    // Some busy (Most booked), some quiet, a few empty.
    const count = pick([0, 2, 5, 8, 12, 18, 25, 35]);
    if (count === 0) continue;
    const result = await seedBookings(venue.id, { count, days: 6, payRate: 0.85, seed: 1000 + i });
    console.log(`  ${venue.name}: ${result.made}`);
  }

  console.log("Freed lately…");
  // As if bookings there were cancelled in the last day (customer cancelling isn't built yet):
  // free evening times in the next two days at about ten venues.
  for (const venue of shuffled(venues).slice(0, 10)) {
    const ground = pick(venue.grounds);
    const slots = (await freeSlots(ground.id, 2)).slice(0, 6);
    for (const slot of shuffled(slots).slice(0, between(1, 2))) {
      await prisma.groundSlot.updateMany({
        where: { groundId: ground.id, startsAt: slot.startsAt },
        data: { freedAt: new Date(Date.now() - between(1, 18) * HOUR) },
      });
    }
  }

  console.log("\nDone. Sign in with:");
  console.log(
    `  Admin   ${ACCOUNTS.admin.email} / ${ACCOUNTS.admin.password} (set up the authenticator)`,
  );
  console.log(`  Staff   ${ACCOUNTS.owner.phone} / ${ACCOUNTS.owner.password} (owns all 50)`);
  console.log(`  Player  ${ACCOUNTS.player.phone} / ${ACCOUNTS.player.password} (history)`);
  console.log(`  New     ${ACCOUNTS.newcomer.phone} / ${ACCOUNTS.newcomer.password} (no bookings)`);
} finally {
  await prisma.$disconnect();
  cache.disconnect();
  queueConnection.disconnect();
}
