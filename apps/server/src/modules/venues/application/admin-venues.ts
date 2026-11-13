import type { AdminVenue, AdminVenueQuery, VenueStatus } from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/platform/db/prisma";
import { placeOf } from "../domain/names";
import { venueNotFound } from "./access";

// The admin Venues table: every venue in any status, newest first, a page at a time. Ids are UUIDv7,
// so ordering by id is ordering by creation, and the last id on a page is the cursor for the next.

const STATUSES: VenueStatus[] = ["DRAFT", "SUBMITTED", "PROVISIONING", "LIVE", "MAINTENANCE"];

const place = { translations: { select: { language: true, name: true } } } as const;

export const adminVenueSelect = {
  id: true,
  slug: true,
  status: true,
  createdAt: true,
  marketplace: { select: { id: true, code: true } },
  translations: { select: { language: true, name: true } },
  location: { select: { ...place, parent: { select: place } } },
  memberships: {
    where: { role: "OWNER" },
    select: { staff: { select: { id: true, name: true, phone: true } } },
  },
  _count: { select: { grounds: { where: { status: { not: "DELETED" } } } } },
} as const satisfies Prisma.VenueSelect;

type Row = Prisma.VenueGetPayload<{ select: typeof adminVenueSelect }>;

export const presentAdminVenue = (venue: Row): AdminVenue => {
  const exact = (language: "EN" | "AR") =>
    venue.translations.find((t) => t.language === language)?.name ?? null;
  const owner = venue.memberships[0]?.staff ?? null;
  return {
    id: venue.id,
    slug: venue.slug,
    names: { en: exact("EN"), ar: exact("AR") },
    status: venue.status,
    marketplace: venue.marketplace,
    area: placeOf(venue.location, "EN"),
    owner,
    groundCount: venue._count.grounds,
    createdAt: venue.createdAt.toISOString(),
  };
};

// Prisma escapes nothing in `contains`, so % and _ would act as wildcards.
const literal = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

export const listAdminVenues = async ({ status, q, cursor, limit }: AdminVenueQuery) => {
  const search: Prisma.VenueWhereInput = q
    ? {
        OR: [
          {
            translations: {
              some: { name: { contains: literal(q), mode: "insensitive" } },
            },
          },
          { slug: { contains: literal(q.toLowerCase()) } },
        ],
      }
    : {};

  const [rows, groups] = await Promise.all([
    prisma.venue.findMany({
      where: { ...search, ...(status && { status }), ...(cursor && { id: { lt: cursor } }) },
      orderBy: { id: "desc" },
      take: limit + 1,
      select: adminVenueSelect,
    }),
    // For the status tabs: how many match the search in each status.
    prisma.venue.groupBy({ by: ["status"], where: search, _count: true }),
  ]);

  const more = rows.length > limit;
  const data = (more ? rows.slice(0, limit) : rows).map(presentAdminVenue);
  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, groups.find((g) => g.status === s)?._count ?? 0]),
  ) as Record<VenueStatus, number>;
  return { data, nextCursor: more ? (data.at(-1)?.id ?? null) : null, counts };
};

// One venue, for the header of its admin dashboard.
export const getAdminVenue = async (id: string): Promise<AdminVenue> => {
  const venue = await prisma.venue.findUnique({ where: { id }, select: adminVenueSelect });
  if (!venue) throw venueNotFound();
  return presentAdminVenue(venue);
};
