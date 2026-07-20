import { parseGoogleMapsLink } from "@/domains/pitches/pitches.validator.js";
import { ERROR_CODES, InternalServerError, NotFoundError } from "@/shared/lib/utils/error.js";

export default async function verifyGoogleMapsLink(url: string) {
    const parsed = parseGoogleMapsLink(url);

    if (!parsed) {
        throw new NotFoundError("Could not identify a valid location or address in this link.", ERROR_CODES.GOOGLE_MAPS_LINK_INVALID);
    }

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new InternalServerError("Could not find Google Maps API key. Please setup the .env variables properly.");

    const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    endpoint.searchParams.set("key", key);

    if (parsed.type === "coordinates") {
        endpoint.searchParams.set("latlng", `${parsed.latitude},${parsed.longitude}`);
    } else {
        endpoint.searchParams.set("address", parsed.query);
    }

    let data;

    try {
        const res = await fetch(endpoint.toString());
        data = await res.json();
    } catch (error) {
        console.error(error);
        throw new InternalServerError("An error has occurred while verifying the Google Maps link.");
    }

    if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;

        return {
            latitude: location.lat,
            longitude: location.lng
        };
    }

    throw new NotFoundError("Could not find the location.", ERROR_CODES.GOOGLE_MAPS_LINK_INVALID);
};