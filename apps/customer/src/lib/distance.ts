import * as Location from "expo-location";
import { useEffect, useState } from "react";
import i18n from "@/i18next/i18next";

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
  if (metres < 1000) {
    return i18n.t("formats.metres", { value: Math.max(10, Math.round(metres / 10) * 10) });
  }
  const km = metres / 1000;
  return i18n.t("formats.km", { value: km < 10 ? km.toFixed(1) : Math.round(km) });
};

// Where the phone is: undefined while it's still being found, null when it can't be (location
// not allowed, or no fix), so a screen can wait for the answer before searching.
export const useHere = () => {
  const [here, setHere] = useState<Point | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status === "undetermined" && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (permission.status !== "granted") {
          if (active) setHere(null);
          return;
        }
        const fix =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (active) setHere({ latitude: fix.coords.latitude, longitude: fix.coords.longitude });
      } catch {
        // No fix (location off, simulator).
        if (active) setHere(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return here;
};

export const useDistanceTo = (place: Point | null) => {
  const here = useHere();
  if (!place || !here) return null;
  return formatDistance(metresBetween(here, place));
};
