import type { AdminAccountQuery, AdminCustomerAccount, AdminStaffAccount } from "@hagz/contracts";
import { prisma } from "@/platform/db/prisma";

// The admin's Support page (plan 2.8): staff and customers, newest first, a page at a time, found by
// name or phone. Ids are UUIDv7, so ordering by id is ordering by sign-up, and the last id on a
// page is the cursor for the next. Deleted accounts are left out: there's nothing left to help with.

// LIKE treats % and _ as wildcards; a search for them should find them.
const literal = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

// A name, or a phone typed any way: "0100 123 4567", "+20 100…" and "1001234567" all find
// +201001234567. Digits are matched without a leading 0, which a local number has and E.164 drops.
const matching = (q: string | undefined) => {
  if (!q) return {};
  const digits = q.replace(/\D/g, "").replace(/^0+/, "");
  return {
    OR: [
      { name: { contains: literal(q), mode: "insensitive" as const } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ],
  };
};

const where = ({ q, status, cursor }: AdminAccountQuery) => ({
  deletedAt: null,
  ...matching(q),
  ...(status && { status }),
  ...(cursor && { id: { lt: cursor } }),
});

const account = {
  id: true,
  name: true,
  phone: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

const present = (row: {
  id: string;
  name: string;
  phone: string | null;
  status: AdminStaffAccount["status"];
  createdAt: Date;
  lastLoginAt: Date | null;
}) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
  lastSignedInAt: row.lastLoginAt?.toISOString() ?? null,
});

const paged = <T extends { id: string }>(rows: T[], limit: number) => {
  const more = rows.length > limit;
  const data = more ? rows.slice(0, limit) : rows;
  return { data, nextCursor: more ? (data.at(-1)?.id ?? null) : null };
};

export const listStaffAccounts = async (query: AdminAccountQuery) => {
  const rows = await prisma.staff.findMany({
    where: where(query),
    orderBy: { id: "desc" },
    take: query.limit + 1,
    select: {
      ...account,
      memberships: {
        // Owned venues first (OWNER is declared before MEMBER), then in the order they joined.
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: {
          role: true,
          venue: {
            select: { id: true, translations: { select: { language: true, name: true } } },
          },
        },
      },
    },
  });
  const { data, nextCursor } = paged(rows, query.limit);
  return {
    data: data.map((row): AdminStaffAccount => ({
      ...present(row),
      venues: row.memberships.map(({ role, venue }) => {
        const name = (language: "EN" | "AR") =>
          venue.translations.find((t) => t.language === language)?.name ?? null;
        return { id: venue.id, name: name("EN") ?? name("AR"), role };
      }),
    })),
    nextCursor,
  };
};

export const listCustomerAccounts = async (query: AdminAccountQuery) => {
  const rows = await prisma.customer.findMany({
    where: where(query),
    orderBy: { id: "desc" },
    take: query.limit + 1,
    select: account,
  });
  const { data, nextCursor } = paged(rows, query.limit);
  return { data: data.map((row): AdminCustomerAccount => present(row)), nextCursor };
};
