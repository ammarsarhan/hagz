import type { Coordinates } from "@hagz/contracts";
import type { Tx } from "@/platform/db/transaction";
import { AppError } from "@/platform/errors/app-error";

// Whether a venue's pin agrees with where it says it is, checked by the database (PostGIS) against
// Hagz's own data, never Google's: the app finds the spot with Google, but the server only ever sees
// coordinates and an area id, and trusts neither (docs/onboarding.md, "The pin and the area").
//
//   inside the country   the marketplace's border (Marketplace.boundary) covers the pin, so a pin
//                        dropped abroad can't be filed under an Egyptian area. No border: no check.
//   near the area        the pin is within PIN_NEAR_AREA_METRES of the area's centre, so a pin in
//                        Aswan can't be listed under Smouha. An area without a centre: no check.

// The area picker suggests areas within 8 km of a pin (SUGGEST_WITHIN_METRES), and a venue sits
// somewhere inside its area, not on the centre. Large districts (New Cairo, 6th of October) reach
// well past 8 km from their middle, so the check allows about twice that: far enough for any
// venue honestly in the area, close enough to catch one filed in the wrong part of the country.
export const PIN_NEAR_AREA_METRES = 15_000;

export const locationOutsideMarketplace = () =>
  new AppError({
    code: "LOCATION_OUTSIDE_MARKETPLACE",
    status: 422,
    detail: "The pin isn't in the same country as the area.",
  });

export const pinFarFromArea = (areaId: string, distance: number) =>
  new AppError({
    code: "PIN_FAR_FROM_AREA",
    status: 422,
    detail:
      "The pin is too far from the area to be listed under it. Move the pin or pick another area.",
    // How far, in metres, so a screen can say so; the limit is PIN_NEAR_AREA_METRES.
    extensions: { areaId, distance, limit: PIN_NEAR_AREA_METRES },
  });

export const checkPin = async (
  tx: Tx,
  {
    marketplaceId,
    locationId,
    pin,
  }: { marketplaceId: string; locationId?: string | null; pin: Coordinates },
) => {
  const [row] = await tx.$queryRaw<{ inside: boolean | null; distance: number | null }[]>`
    WITH p AS (
      SELECT ST_SetSRID(ST_MakePoint(${pin.longitude}, ${pin.latitude}), 4326)::geography AS point
    )
    SELECT
      (SELECT ST_Covers(m.boundary, p.point) FROM "Marketplace" m
        WHERE m.id = ${marketplaceId}::uuid AND m.boundary IS NOT NULL) AS inside,
      (SELECT round(ST_Distance(l.center, p.point))::int FROM "Location" l
        WHERE l.id = ${locationId ?? null}::uuid AND l.center IS NOT NULL
          AND NOT ST_DWithin(l.center, p.point, ${PIN_NEAR_AREA_METRES})) AS distance
    FROM p`;
  if (row?.inside === false) throw locationOutsideMarketplace();
  if (locationId && row?.distance != null) throw pinFarFromArea(locationId, row.distance);
};
