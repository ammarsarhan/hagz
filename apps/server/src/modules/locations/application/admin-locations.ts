import type { AdminLocation, CreateLocation, UpdateLocation } from "@hagz/contracts";
import { isForeignKeyViolation, violatedUniqueIndex } from "@/platform/db/errors";
import { prisma } from "@/platform/db/prisma";
import { transaction, type Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import { slugify } from "../domain/slug";
import { marketplaceNotFound } from "./admin-marketplaces";
import { lockMarketplace, namesOf, translationRows, upsertNames } from "./names";

// Admin management of a marketplace's location tree. The slug comes from the English name when the
// location is created and never changes, because it's part of public URLs. A location can be deleted
// only while nothing hangs off it: no child locations and no venues. The database enforces both
// (RESTRICT foreign keys), so a venue created at the same moment can't slip past the check.

const locationNotFound = () =>
  new AppError({ code: "LOCATION_NOT_FOUND", status: 404, detail: "No such location." });

const include = { translations: true, _count: { select: { children: true, venues: true } } };

type Row = NonNullable<Awaited<ReturnType<typeof findOne>>>;
const findOne = (id: string) => prisma.location.findUnique({ where: { id }, include });

// Prisma can't read or write PostGIS columns, so the centre goes through SQL.
type Center = AdminLocation["center"];

const centersOf = async (ids: string[]) => {
  const rows = await prisma.$queryRaw<{ id: string; latitude: number; longitude: number }[]>`
    SELECT id, ST_Y(center::geometry) AS latitude, ST_X(center::geometry) AS longitude
    FROM "Location" WHERE id = ANY(${ids}::uuid[]) AND center IS NOT NULL`;
  return new Map(rows.map(({ id, latitude, longitude }) => [id, { latitude, longitude }]));
};

const setCenter = (tx: Tx, id: string, center: Center) =>
  center
    ? tx.$executeRaw`
        UPDATE "Location"
        SET center = ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography
        WHERE id = ${id}::uuid`
    : tx.$executeRaw`UPDATE "Location" SET center = NULL WHERE id = ${id}::uuid`;

const present = (l: Row, center: Center): AdminLocation => ({
  id: l.id,
  parentId: l.parentId,
  locality: l.locality,
  slug: l.slug,
  names: namesOf(l.translations),
  center,
  childCount: l._count.children,
  venueCount: l._count.venues,
  createdAt: l.createdAt.toISOString(),
});

// Every location in the marketplace, flat; the tree is built from parentId.
export const listAdminLocations = async (marketplaceId: string): Promise<AdminLocation[]> => {
  const exists = await prisma.marketplace.count({ where: { id: marketplaceId } });
  if (!exists) throw marketplaceNotFound();
  const rows = await prisma.location.findMany({
    where: { marketplaceId },
    orderBy: { slug: "asc" },
    include,
  });
  const centers = await centersOf(rows.map((row) => row.id));
  return rows.map((row) => present(row, centers.get(row.id) ?? null));
};

export const createLocation = async (
  marketplaceId: string,
  input: CreateLocation,
  adminId: string,
): Promise<AdminLocation> => {
  const slug = slugify(input.names.en);
  try {
    const created = await transaction(async (tx) => {
      if (!(await lockMarketplace(tx, marketplaceId, "share"))) throw marketplaceNotFound();
      if (input.parentId) {
        const parent = await tx.location.findFirst({
          where: { id: input.parentId, marketplaceId },
          select: { id: true },
        });
        if (!parent) {
          throw new AppError({
            code: "PARENT_NOT_FOUND",
            status: 422,
            detail: "The parent location isn't in this marketplace.",
          });
        }
      }
      const location = await tx.location.create({
        data: {
          marketplaceId,
          parentId: input.parentId,
          locality: input.locality,
          slug,
          translations: { create: translationRows(input.names) },
        },
        include,
      });
      if (input.center) await setCenter(tx, location.id, input.center);
      return location;
    });
    logger.info({ adminId, locationId: created.id, marketplaceId }, "location created");
    return present(created, input.center ?? null);
  } catch (error) {
    const index = violatedUniqueIndex(error);
    if (index === "Location_root_slug_key" || index === "Location_child_slug_key") {
      throw new AppError({
        code: "LOCATION_EXISTS",
        status: 409,
        detail: `There's already a "${slug}" at this level.`,
        extensions: { slug },
      });
    }
    throw error;
  }
};

export const updateLocation = async (
  id: string,
  input: UpdateLocation,
  adminId: string,
): Promise<AdminLocation> => {
  await transaction(async (tx) => {
    const found = await tx.location.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw locationNotFound();
    if (input.locality)
      await tx.location.update({ where: { id }, data: { locality: input.locality } });
    if (input.names) {
      await upsertNames(
        (row) =>
          tx.locationTranslation.upsert({
            where: { locationId_language: { locationId: id, language: row.language } },
            create: { locationId: id, ...row },
            update: { name: row.name },
          }),
        input.names,
      );
    }
    if (input.center !== undefined) await setCenter(tx, id, input.center);
  });
  logger.info({ adminId, locationId: id, fields: Object.keys(input) }, "location updated");
  const updated = await findOne(id);
  if (!updated) throw locationNotFound();
  return present(updated, (await centersOf([id])).get(id) ?? null);
};

export const deleteLocation = async (id: string, adminId: string): Promise<void> => {
  try {
    const { count } = await prisma.location.deleteMany({ where: { id } });
    if (count === 0) throw locationNotFound();
  } catch (error) {
    // A child location or a venue still points at it.
    if (isForeignKeyViolation(error)) {
      throw new AppError({
        code: "LOCATION_IN_USE",
        status: 409,
        detail: "It has locations under it or venues in it. Move or remove those first.",
      });
    }
    throw error;
  }
  logger.info({ adminId, locationId: id }, "location deleted");
};
