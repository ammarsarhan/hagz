import type { AdminMarketplace, CreateMarketplace, UpdateMarketplace } from "@hagz/contracts";
import { violatedUniqueIndex } from "@/platform/db/errors";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import { lockMarketplace, namesOf, translationRows, upsertNames } from "./names";

// Admin management of marketplaces (agreed 2026-11-08): created hidden, never deleted (turned off
// instead). Code and currency are fixed once anything uses the marketplace: a location, a venue or an
// amenity option. URLs carry the code, and prices and payouts the currency. VAT and commission can
// change; they apply to bookings made after the change.

export const marketplaceNotFound = () =>
  new AppError({ code: "MARKETPLACE_NOT_FOUND", status: 404, detail: "No such marketplace." });

const include = {
  translations: true,
  _count: { select: { locations: true, venues: true, amenities: true } },
} as const;

type Row = NonNullable<Awaited<ReturnType<typeof findOne>>>;
const findOne = (id: string) => prisma.marketplace.findUnique({ where: { id }, include });

const present = (m: Row): AdminMarketplace => {
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
    createdAt: m.createdAt.toISOString(),
  };
};

export const listAdminMarketplaces = async (): Promise<AdminMarketplace[]> =>
  (await prisma.marketplace.findMany({ orderBy: { code: "asc" }, include })).map(present);

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
  const { names, ...fields } = input;
  try {
    const created = await prisma.marketplace.create({
      data: { ...fields, isActive: false, translations: { create: translationRows(names) } },
      include,
    });
    logger.info({ adminId, marketplaceId: created.id, code: created.code }, "marketplace created");
    return present(created);
  } catch (error) {
    throw codeTaken(error);
  }
};

export const updateMarketplace = async (
  id: string,
  input: UpdateMarketplace,
  adminId: string,
): Promise<AdminMarketplace> => {
  const { names, ...fields } = input;
  try {
    await transaction(async (tx) => {
      // Locked, so a location or amenity can't be added between the check and the change.
      if (!(await lockMarketplace(tx, id, "update"))) throw marketplaceNotFound();
      const current = await tx.marketplace.findUniqueOrThrow({ where: { id }, include });
      const fixed = (["code", "currency"] as const).filter(
        (field) => fields[field] !== undefined && fields[field] !== current[field],
      );
      if (fixed.length > 0 && present(current).inUse) {
        throw new AppError({
          code: "MARKETPLACE_IN_USE",
          status: 409,
          detail: "Its code and currency can't change once it has locations, venues or amenities.",
          extensions: { fields: fixed },
        });
      }
      await tx.marketplace.update({ where: { id }, data: fields });
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
  return present(updated);
};
