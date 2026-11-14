import type {
  AdminMarketplace,
  Boundary,
  CreateMarketplace,
  UpdateMarketplace,
} from "@hagz/contracts";
import { violatedUniqueIndex } from "@/platform/db/errors";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import { lockMarketplace, namesOf, translationRows, upsertNames } from "./names";

// Admin management of marketplaces (agreed 2026-11-08): created hidden, never deleted (turned off
// instead), and the last live one can't be turned off (2026-11-09). Code and currency are fixed
// once anything uses the marketplace: a location, a venue or an amenity option. URLs carry the
// code, and prices and payouts the currency. VAT and commission can change; they apply to bookings
// made after the change.
//
// Its border (Marketplace.boundary) is what venue pins are checked against (venues' pin-checks.ts).
// It's PostGIS, which Prisma can't read or write, so it goes through SQL, and the list only says
// whether there is one: a border is thousands of points nobody needs in a table.

export const marketplaceNotFound = () =>
  new AppError({ code: "MARKETPLACE_NOT_FOUND", status: 404, detail: "No such marketplace." });

const include = {
  translations: true,
  _count: { select: { locations: true, venues: true, amenities: true } },
} as const;

type Row = NonNullable<Awaited<ReturnType<typeof findOne>>>;
const findOne = (id: string) => prisma.marketplace.findUnique({ where: { id }, include });

export const invalidBoundary = (reason: string) =>
  new AppError({
    code: "INVALID_BOUNDARY",
    status: 422,
    detail: "That border isn't a valid shape. Check that its edges don't cross.",
    extensions: { reason },
  });

// The marketplaces among these that have a border.
const withBoundary = async (ids: string[]) =>
  new Set(
    (
      await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Marketplace" WHERE id = ANY(${ids}::uuid[]) AND boundary IS NOT NULL`
    ).map((row) => row.id),
  );

// Sets the border, or clears it with null. PostGIS judges the shape first, so a crossing edge is a
// 422 with its reason rather than the table's CHECK failing.
const setBoundary = async (tx: Tx, id: string, boundary: Boundary | null) => {
  if (boundary === null) {
    await tx.$executeRaw`UPDATE "Marketplace" SET boundary = NULL WHERE id = ${id}::uuid`;
    return;
  }
  const geojson = JSON.stringify(boundary);
  const [shape] = await tx.$queryRaw<{ valid: boolean; reason: string }[]>`
    SELECT ST_IsValid(g) AS valid, ST_IsValidReason(g) AS reason
    FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326) AS g) AS shape`;
  if (!shape?.valid) throw invalidBoundary(shape?.reason ?? "Unknown");
  await tx.$executeRaw`
    UPDATE "Marketplace"
    SET boundary = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326))::geography
    WHERE id = ${id}::uuid`;
};

const present = (m: Row, hasBoundary: boolean): AdminMarketplace => {
  const { locations, venues, amenities } = m._count;
  return {
    id: m.id,
    code: m.code,
    names: namesOf(m.translations),
    currency: m.currency,
    dialCode: m.dialCode,
    timezone: m.timezone,
    taxRate: m.taxRate,
    commissionRate: m.commissionRate,
    isActive: m.isActive,
    inUse: locations + venues + amenities > 0,
    locationCount: locations,
    venueCount: venues,
    amenityCount: amenities,
    hasBoundary,
    createdAt: m.createdAt.toISOString(),
  };
};

export const listAdminMarketplaces = async (): Promise<AdminMarketplace[]> => {
  const rows = await prisma.marketplace.findMany({ orderBy: { code: "asc" }, include });
  const bordered = await withBoundary(rows.map((row) => row.id));
  return rows.map((row) => present(row, bordered.has(row.id)));
};

const codeTaken = (error: unknown) =>
  violatedUniqueIndex(error) === "Marketplace_code_key"
    ? new AppError({
        code: "MARKETPLACE_EXISTS",
        status: 409,
        detail: "A marketplace with that code already exists.",
      })
    : error;

export const createMarketplace = async (
  input: CreateMarketplace,
  adminId: string,
): Promise<AdminMarketplace> => {
  const { names, boundary, ...fields } = input;
  try {
    const created = await transaction(async (tx) => {
      const row = await tx.marketplace.create({
        data: { ...fields, isActive: false, translations: { create: translationRows(names) } },
        include,
      });
      if (boundary) await setBoundary(tx, row.id, boundary);
      return row;
    });
    logger.info({ adminId, marketplaceId: created.id, code: created.code }, "marketplace created");
    return present(created, Boolean(boundary));
  } catch (error) {
    throw codeTaken(error);
  }
};

export const updateMarketplace = async (
  id: string,
  input: UpdateMarketplace,
  adminId: string,
): Promise<AdminMarketplace> => {
  const { names, boundary, ...fields } = input;
  try {
    await transaction(async (tx) => {
      // Locked, so a location or amenity can't be added between the check and the change.
      if (!(await lockMarketplace(tx, id, "update"))) throw marketplaceNotFound();
      const current = await tx.marketplace.findUniqueOrThrow({ where: { id }, include });
      const fixed = (["code", "currency"] as const).filter(
        (field) => fields[field] !== undefined && fields[field] !== current[field],
      );
      const { locations, venues, amenities } = current._count;
      if (fixed.length > 0 && locations + venues + amenities > 0) {
        throw new AppError({
          code: "MARKETPLACE_IN_USE",
          status: 409,
          detail: "Its code and currency can't change once it has locations, venues or amenities.",
          extensions: { fields: fixed },
        });
      }
      // The apps need a marketplace to show, so the last live one can't be hidden. Hides take one
      // lock in turn, so two admins hiding the last two at once can't each see the other as live.
      if (fields.isActive === false && current.isActive) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('marketplace-visibility'))`;
        const othersLive = await tx.marketplace.count({
          where: { isActive: true, id: { not: id } },
        });
        if (othersLive === 0) {
          throw new AppError({
            code: "LAST_LIVE_MARKETPLACE",
            status: 409,
            detail: "It's the only marketplace live in the apps. Make another one live first.",
          });
        }
      }
      await tx.marketplace.update({ where: { id }, data: fields });
      if (boundary !== undefined) await setBoundary(tx, id, boundary);
      if (names) {
        await upsertNames(
          (row) =>
            tx.marketplaceTranslation.upsert({
              where: { marketplaceId_language: { marketplaceId: id, language: row.language } },
              create: { marketplaceId: id, ...row },
              update: { name: row.name },
            }),
          names,
        );
      }
    });
  } catch (error) {
    throw codeTaken(error);
  }
  logger.info({ adminId, marketplaceId: id, fields: Object.keys(input) }, "marketplace updated");
  const updated = await findOne(id);
  if (!updated) throw marketplaceNotFound();
  return present(updated, (await withBoundary([id])).has(id));
};
