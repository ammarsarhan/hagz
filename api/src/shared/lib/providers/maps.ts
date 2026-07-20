import { ERROR_CODES, InternalServerError, NotFoundError } from "../utils/error.js";

export default async function verifyGoogleMapsLink(address: string) {
    try {
        const key = process.env.GOOGLE_MAPS_API_KEY!;
        const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;

        const res = await fetch(endpoint);
        const data = await res.json();

        if (data.status === 'OK' && data.results.length > 0) {
            const location = data.results[0].geometry.location;

            return {
                latitude: location.lat,
                longitude: location.lng
            };
        };
        
        throw new NotFoundError("Could not find the location.", ERROR_CODES.GOOGLE_MAPS_LINK_INVALID);
    } catch {
        throw new InternalServerError("An error has occurred while verifying the Google Maps link.");
    }
}