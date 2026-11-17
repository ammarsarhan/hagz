import { Boundary, type Coordinates } from "@hagz/contracts";

// Typing an area's centre and loading a country's border, for the Platform page's forms.

// "30.0444, 31.2357": latitude then longitude, which is what Google Maps copies when you right-click
// a spot. Null when it isn't a point on Earth.
export const parseCenter = (text: string): Coordinates | null => {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

// Five decimals is about a metre: as precise as a centre needs to be.
export const formatCenter = (center: Coordinates | null) =>
  center ? `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}` : "";

export const mapsLink = ({ latitude, longitude }: Coordinates) =>
  `https://www.google.com/maps/search/?api=1&query=${String(latitude)},${String(longitude)}`;

// A border from a GeoJSON file as most tools export it: a bare Polygon or MultiPolygon, a Feature,
// or a FeatureCollection, whose polygons are joined into one MultiPolygon. Throws a sentence for
// the admin when it isn't a border. The API checks the edges don't cross.
export const readBoundary = (text: string): Boundary => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("That file isn't JSON.");
  }
  const geometries = geometriesOf(json);
  const polygons = geometries.flatMap((geometry) => {
    const parsed = Boundary.safeParse(geometry);
    if (!parsed.success) return [];
    return parsed.data.type === "Polygon" ? [parsed.data.coordinates] : parsed.data.coordinates;
  });
  if (polygons.length === 0) {
    throw new Error("No country shape in that file: it needs a Polygon or MultiPolygon.");
  }
  const [only] = polygons;
  return polygons.length === 1 && only
    ? { type: "Polygon", coordinates: only }
    : { type: "MultiPolygon", coordinates: polygons };
};

const geometriesOf = (json: unknown): unknown[] => {
  if (typeof json !== "object" || json === null) return [];
  const node = json as { type?: unknown; geometry?: unknown; features?: unknown };
  if (node.type === "FeatureCollection" && Array.isArray(node.features)) {
    return node.features.flatMap(geometriesOf);
  }
  if (node.type === "Feature") return geometriesOf(node.geometry);
  return [json];
};

// How big a border is, to say what was loaded: "1 shape" for a mainland, more with islands.
export const shapeCount = (boundary: Boundary) =>
  boundary.type === "Polygon" ? 1 : boundary.coordinates.length;
