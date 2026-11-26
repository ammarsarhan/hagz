import type {
  CreateVenueCustomer,
  UpdateVenueCustomer,
  VenueCustomer,
  VenueCustomerPage,
  VenueCustomersQuery,
} from "@hagz/contracts";
import type { Prisma } from "@/generated/prisma/client";
import { violatedUniqueIndex } from "@/platform/db/errors";
import { prisma } from "@/platform/db/prisma";
import { AppError } from "@/platform/errors/app-error";
import { requireMobileNumber } from "@/platform/phone/phone";
import type { VenueAccess } from "./access";

// The venue's customers for its staff (PR 4.3): app players who booked there and walk-ins staff
// entered, A to Z. Staff fix a walk-in's name and number; an app player's follow their account. Any
// customer can carry a note for the staff only.

const PHONE_INDEX = "VenueCustomer_venueId_phone_key";

export const venueCustomerNotFound = () =>
  new AppError({
    code: "CUSTOMER_NOT_FOUND",
    status: 404,
    detail: "This venue has no such customer.",
  });

const numberTaken = (customerId: string | undefined) =>
  new AppError({
    code: "CUSTOMER_EXISTS",
    status: 409,
    detail: "One of the venue's customers already has this number.",
    extensions: customerId ? { customerId } : {},
  });

const linked = () =>
  new AppError({
    code: "CUSTOMER_LINKED",
    status: 409,
    detail: "This customer's name and number come from their Hagz account.",
  });

const invalidCursor = () =>
  new AppError({
    code: "INVALID_CURSOR",
    status: 400,
    detail: "That page link has expired. Load the list again.",
  });

// Prisma escapes nothing in `contains`, so % and _ would act as wildcards.
const literal = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

const select = {
  id: true,
  name: true,
  phone: true,
  customerId: true,
  note: true,
  lastBookedAt: true,
  bookingCount: true,
  noShowCount: true,
  createdAt: true,
} as const satisfies Prisma.VenueCustomerSelect;

type Row = Prisma.VenueCustomerGetPayload<{ select: typeof select }>;

const present = (row: Row): VenueCustomer => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  app: row.customerId !== null,
  note: row.note,
  lastBookedAt: row.lastBookedAt?.toISOString() ?? null,
  bookingCount: row.bookingCount,
  noShowCount: row.noShowCount,
  createdAt: row.createdAt.toISOString(),
});

const encodeCursor = (row: { name: string; id: string }) =>
  Buffer.from(JSON.stringify([row.name, row.id])).toString("base64url");

const decodeCursor = (text: string) => {
  try {
    const [name, id] = JSON.parse(Buffer.from(text, "base64url").toString()) as unknown[];
    if (typeof name !== "string" || typeof id !== "string") throw new Error("Malformed.");
    return { name, id };
  } catch {
    throw invalidCursor();
  }
};

export const listVenueCustomers = async (
  actor: VenueAccess,
  { q, order, cursor, limit }: VenueCustomersQuery,
): Promise<VenueCustomerPage> => {
  const text = q ? literal(q) : null;
  const digits = q?.replace(/[\s()-]/g, "");
  const after = cursor ? decodeCursor(cursor) : null;
  const rows = await prisma.venueCustomer.findMany({
    where: {
      venueId: actor.venueId,
      ...(text && {
        OR: [
          { name: { contains: text, mode: "insensitive" } },
          ...(digits ? [{ phone: { contains: literal(digits) } }] : []),
        ],
      }),
      ...(after &&
        order === "name" && {
          AND: [
            {
              OR: [{ name: { gt: after.name } }, { name: after.name, id: { gt: after.id } }],
            },
          ],
        }),
    },
    orderBy:
      order === "recent"
        ? [{ lastBookedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }]
        : [{ name: "asc" }, { id: "asc" }],
    take: limit + 1,
    select,
  });
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    data: page.map(present),
    nextCursor: order === "name" && rows.length > limit && last ? encodeCursor(last) : null,
  };
};

const find = async (venueId: string, id: string) => {
  const row = await prisma.venueCustomer.findFirst({ where: { id, venueId }, select });
  if (!row) throw venueCustomerNotFound();
  return row;
};

export const venueCustomerDetail = async (actor: VenueAccess, id: string) =>
  present(await find(actor.venueId, id));

const existingWithNumber = (venueId: string, phone: string) =>
  prisma.venueCustomer.findUnique({
    where: { venueId_phone: { venueId, phone } },
    select: { id: true },
  });

// A walk-in entered by staff. A number one of the venue's customers already has is refused, with
// that customer's id, so the app can open them instead.
export const createVenueCustomer = async (
  actor: VenueAccess,
  { name, phone, note }: CreateVenueCustomer,
): Promise<VenueCustomer> => {
  const e164 = phone ? requireMobileNumber(phone).e164 : null;
  try {
    const row = await prisma.venueCustomer.create({
      data: {
        venueId: actor.venueId,
        name,
        phone: e164,
        note: note === "" ? null : (note ?? null),
      },
      select,
    });
    return present(row);
  } catch (error) {
    if (violatedUniqueIndex(error) === PHONE_INDEX && e164) {
      throw numberTaken((await existingWithNumber(actor.venueId, e164))?.id);
    }
    throw error;
  }
};

export const updateVenueCustomer = async (
  actor: VenueAccess,
  id: string,
  { name, phone, note }: UpdateVenueCustomer,
): Promise<VenueCustomer> => {
  const current = await find(actor.venueId, id);
  if (current.customerId !== null && (name !== undefined || phone !== undefined)) throw linked();
  const e164 = phone ? requireMobileNumber(phone).e164 : phone;
  const identity = name !== undefined || e164 !== undefined;
  try {
    // Name and number only while it's still a walk-in: signing up can link it at any moment.
    const { count } = await prisma.venueCustomer.updateMany({
      where: { id: current.id, ...(identity && { customerId: null }) },
      data: {
        ...(name !== undefined && { name }),
        ...(e164 !== undefined && { phone: e164 }),
        ...(note !== undefined && { note: note === "" ? null : note }),
      },
    });
    if (count === 0) throw linked();
    return present(await find(actor.venueId, current.id));
  } catch (error) {
    if (violatedUniqueIndex(error) === PHONE_INDEX && e164) {
      throw numberTaken((await existingWithNumber(actor.venueId, e164))?.id);
    }
    throw error;
  }
};
