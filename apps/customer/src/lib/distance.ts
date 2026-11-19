import * as Location from "expo-location";
import { useEffect, useState } from "react";

// How far a place is from the player, for "Borg El Arab, Alexandria (5.5 km)". From the phone's
// last known position when the player has allowed location, asked for once if they haven't been
// asked yet; nothing at all when they said no, so the page never nags.

interface Point {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

// Straight-line metres between two points (haversine).
export const metresBetween = (a: Point, b: Point) => {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

// 850 → "850 m", 5_480 → "5.5 km", 12_300 → "12 km".
export const formatDistance = (metres: number) => {
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
};

export const useDistanceTo = (place: Point | null) => {
  const [distance, setDistance] = useState<string | null>(null);
  const latitude = place?.latitude;
  const longitude = place?.longitude;
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    let active = true;
    void (async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status === "undetermined" && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (permission.status !== "granted") return;
        const here =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (active)
          setDistance(formatDistance(metresBetween(here.coords, { latitude, longitude })));
      } catch {
        // No fix (location off, simulator): the area alone.
      }
    })();
    return () => {
      active = false;
    };
  }, [latitude, longitude]);
  return distance;
};
