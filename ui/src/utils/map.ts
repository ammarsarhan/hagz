import { amenityMap, AmenityType, GroundSizeType, GroundStatusType, GroundSurfaceType, sizeMap, statusMap, surfaceMap } from "@/context/filter";

export function getKeyFromValue<T, K>(map: Map<K, T>, value: T): K | undefined {
    for (const [key, val] of map.entries()) {
      if (val === value) {
        return key;
      }
    }
    return undefined;
}

export function getDisplayStatus(status: GroundStatusType) {
  return getKeyFromValue(statusMap, status);
}

export function getDisplaySize(size: GroundSizeType) {
  return getKeyFromValue(sizeMap, size);
}

export function getDisplaySurface(surface: GroundSurfaceType) {
  return getKeyFromValue(surfaceMap, surface);
}

export function getDisplayAmenity(amenity: AmenityType) {
  return getKeyFromValue(amenityMap, amenity);
}