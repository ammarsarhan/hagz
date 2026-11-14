import Constants from "expo-constants";
import { Platform } from "react-native";
import { language } from "./language";

// Google, for the one job of finding where a venue is: search as the owner types (Places API, New),
// the picked place's point and address, and the address under a pin they moved themselves
// (Geocoding API). Nothing here is stored; what we keep is in the venue the API creates.
//
// The key is public by design (it ships in the app), so it must be restricted in Google Cloud to
// this app's bundle ids and to these APIs (Places API (New) and Geocoding API). Without it the
// search sheet says so rather than failing quietly, and a pin can still be dropped by hand.
const key = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
export const placesConfigured = Boolean(key);

// These are plain HTTPS calls, not the native SDK, so Google can't tell which app is asking unless
// it's told: an app-restricted key turns every request away without these headers. The ids come
// from the app's own config; Android also needs the signing certificate's SHA-1.
const appHeaders = (): Record<string, string> => {
  const config = Constants.expoConfig;
  if (Platform.OS === "ios" && config?.ios?.bundleIdentifier) {
    return { "X-Ios-Bundle-Identifier": config.ios.bundleIdentifier };
  }
  const cert = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CERT;
  if (Platform.OS === "android" && config?.android?.package && cert) {
    return { "X-Android-Package": config.android.package, "X-Android-Cert": cert };
  }
  return {};
};

const PLACES = "https://places.googleapis.com/v1";
const GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";
// Where Hagz operates. Biases search and spelling; the server has the last word on whether a pin is
// inside a marketplace.
const REGION = "EG";

export interface Suggestion {
  placeId: string;
  // What it's called ("Champions Arena").
  name: string;
  // Where it is, in words ("Street 9, Sarayat El Maadi, Cairo").
  address: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// One piece of an address, as Google breaks it up. `types` says what it is ("sublocality_level_1",
// "locality"), which is how an area is matched to ours (lib/areas.ts).
export interface AddressPart {
  name: string;
  types: string[];
}

export interface Place {
  placeId?: string;
  name?: string;
  address: string;
  coordinates: Coordinates;
  parts: AddressPart[];
  // ISO 3166-1 alpha-2, for the marketplace the areas come from.
  country?: string;
}

// Thrown when Google answers with a problem, or can't be reached. Screens show it in the HUD; the
// message is Google's, so it isn't shown to the owner, only logged.
export class PlacesError extends Error {}

const call = async <T>(url: string, init?: RequestInit): Promise<T> => {
  if (!key) throw new PlacesError("EXPO_PUBLIC_GOOGLE_API_KEY is not set.");
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...appHeaders(), ...(init?.headers as Record<string, string> | undefined) },
    });
  } catch (cause) {
    throw new PlacesError(`Google could not be reached: ${String(cause)}`);
  }
  const body = (await response.json().catch(() => null)) as T & {
    error?: { message?: string };
    error_message?: string;
    status?: string;
  };
  if (!response.ok || body === null) {
    throw new PlacesError(body?.error?.message ?? `Google answered ${response.status}.`);
  }
  // The Geocoding API answers a refused key with 200 and an empty list, so its own status is the
  // only sign; ZERO_RESULTS is a real answer (open desert, the sea).
  if (body.status && body.status !== "OK" && body.status !== "ZERO_RESULTS") {
    throw new PlacesError(body.error_message ?? `Google answered ${body.status}.`);
  }
  return body;
};

const headers = (fields?: string) => ({
  "Content-Type": "application/json",
  "X-Goog-Api-Key": key ?? "",
  ...(fields ? { "X-Goog-FieldMask": fields } : {}),
});

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text?: string };
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
    };
  }[];
}

// What the owner is typing, as places near where the map is looking. `sessionToken` ties the
// keystrokes and the chosen place into one billed session: make one per search, drop it after
// details are fetched.
export const searchPlaces = async (
  input: string,
  options: { sessionToken: string; near?: Coordinates },
): Promise<Suggestion[]> => {
  const body = await call<AutocompleteResponse>(`${PLACES}/places:autocomplete`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      input,
      languageCode: language,
      regionCode: REGION,
      sessionToken: options.sessionToken,
      ...(options.near
        ? { locationBias: { circle: { center: options.near, radius: 30000 } } }
        : {}),
    }),
  });
  return (body.suggestions ?? []).flatMap((suggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return [];
    const format = prediction.structuredFormat;
    return [
      {
        placeId: prediction.placeId,
        name: format?.mainText?.text ?? prediction.text?.text ?? "",
        address: format?.secondaryText?.text ?? "",
      },
    ];
  });
};

interface PlaceResponse {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
}

const partsOf = (components: PlaceResponse["addressComponents"]): AddressPart[] =>
  (components ?? []).map((component) => ({
    name: component.longText ?? component.shortText ?? "",
    types: component.types ?? [],
  }));

const countryOf = (components: PlaceResponse["addressComponents"]): string | undefined =>
  components?.find((component) => component.types?.includes("country"))?.shortText;

// The chosen suggestion, in full: the point to drop the pin on and the address to match an area
// from. Pass the same `sessionToken` the search used.
export const placeDetails = async (placeId: string, sessionToken: string): Promise<Place> => {
  const fields = "id,displayName,formattedAddress,location,addressComponents";
  const body = await call<PlaceResponse>(
    `${PLACES}/places/${encodeURIComponent(placeId)}?languageCode=${language}&sessionToken=${encodeURIComponent(sessionToken)}`,
    { headers: headers(fields) },
  );
  const { latitude, longitude } = body.location ?? {};
  if (latitude === undefined || longitude === undefined) {
    throw new PlacesError(`Place ${placeId} came back without a point.`);
  }
  return {
    placeId: body.id ?? placeId,
    name: body.displayName?.text,
    address: body.formattedAddress ?? "",
    coordinates: { latitude, longitude },
    parts: partsOf(body.addressComponents),
    country: countryOf(body.addressComponents),
  };
};

interface GeocodeResponse {
  results?: {
    formatted_address?: string;
    address_components?: { long_name?: string; short_name?: string; types?: string[] }[];
  }[];
}

// The address under a pin the owner moved themselves. Places has no reverse lookup, so this is the
// Geocoding API; its components are named differently but mean the same.
export const addressAt = async (coordinates: Coordinates): Promise<Place> => {
  const url = `${GEOCODE}?latlng=${coordinates.latitude},${coordinates.longitude}&language=${language}&region=${REGION}&key=${key ?? ""}`;
  const body = await call<GeocodeResponse>(url);
  const [first] = body.results ?? [];
  const components = (first?.address_components ?? []).map((component) => ({
    longText: component.long_name,
    shortText: component.short_name,
    types: component.types,
  }));
  return {
    address: first?.formatted_address ?? "",
    coordinates,
    parts: partsOf(components),
    country: countryOf(components),
  };
};
