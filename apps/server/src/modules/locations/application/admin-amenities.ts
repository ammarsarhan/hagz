import type { AdminAmenity, CreateAmenity, UpdateAmenity } from "@hagz/contracts";
import { isForeignKeyViolation, violatedUniqueIndex } from "@/platform/db/errors";
import { prisma } from "@/platform/db/prisma";
import { transaction } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import { marketplaceNotFound } from "./admin-marketplaces";
import { lockMarketplace, namesOf, translationRows, upsertNames } from "./names";

// A marketplace's amenity catalog (floodlights, parking, ...), which venues pick from and price. The
// key is fixed once created. An option can be deleted only while no venue offers it and no booking
// was charged for it (RESTRICT foreign keys); otherwise it's turned off, so venues can't newly pick it.

const amenityNotFound = () =>
  new AppError({ code: "AMENITY_NOT_FOUND", status: 404, detail: "No such amenity option." });

const include = { translations: true, _count: { select: { venues: true } } };

type Row = NonNullable<Awaited<ReturnType<typeof findOne>>>;
const findOne = (id: string) => prisma.amenityOption.findUnique({ where: { id }, include });

const present = (a: Row): AdminAmenity => ({
  id: a.id,
  key: a.key,
  names: namesOf(a.translations),
  isActive: a.isActive,
  venueCount: a._count.venues,
});

export const listAdminAmenities = async (marketplaceId: string): Promise<AdminAmenity[]> => {
  const exists = await prisma.marketplace.count({ where: { id: marketplaceId } });
  if (!exists) throw marketplaceNotFound();
  const rows = await prisma.amenityOption.findMany({
    where: { marketplaceId },
    orderBy: { key: "asc" },
    include,
  });
  return rows.map(present);
};

export const createAmenity = async (
  marketplaceId: string,
  input: CreateAmenity,
  adminId: string,
): Promise<AdminAmenity> => {
  try {
    const created = await transaction(async (tx) => {
      if (!(await lockMarketplace(tx, marketplaceId, "share"))) throw marketplaceNotFound();
      return tx.amenityOption.create({
        data: {
          marketplaceId,
          key: input.key,
          translations: { create: translationRows(input.names) },
        },
        include,
      });
    });
    logger.info({ adminId, amenityId: created.id, marketplaceId }, "amenity option created");
    return present(created);
  } catch (error) {
    if (violatedUniqueIndex(error) === "AmenityOption_marketplaceId_key_key") {
      throw new AppError({
        code: "AMENITY_EXISTS",
        status: 409,
        detail: "This marketplace already has an option with that key.",
      });
    }
    throw error;
  }
};

export const updateAmenity = async (
  id: string,
  input: UpdateAmenity,
  adminId: string,
): Promise<AdminAmenity> => {
  await transaction(async (tx) => {
    const found = await tx.amenityOption.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw amenityNotFound();
    if (input.isActive !== undefined) {
      await tx.amenityOption.update({ where: { id }, data: { isActive: input.isActive } });
    }
    if (input.names) {
      await upsertNames(
        (row) =>
          tx.amenityTranslation.upsert({
            where: { optionId_language: { optionId: id, language: row.language } },
            create: { optionId: id, ...row },
            update: { name: row.name },
          }),
        input.names,
      );
    }
  });
  logger.info({ adminId, amenityId: id, fields: Object.keys(input) }, "amenity option updated");
  const updated = await findOne(id);
  if (!updated) throw amenityNotFound();
  return present(updated);
};

export const deleteAmenity = async (id: string, adminId: string): Promise<void> => {
  try {
    const { count } = await prisma.amenityOption.deleteMany({ where: { id } });
    if (count === 0) throw amenityNotFound();
  } catch (error) {
    // A venue offers it, or a booking was charged for it.
    if (isForeignKeyViolation(error)) {
      throw new AppError({
        code: "AMENITY_IN_USE",
        status: 409,
        detail: "Venues offer it or bookings were charged for it. Turn it off instead.",
      });
    }
    throw error;
  }
  logger.info({ adminId, amenityId: id }, "amenity option deleted");
};
