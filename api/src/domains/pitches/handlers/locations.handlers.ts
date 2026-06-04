import { createFactory } from "hono/factory";
import LocationService from "@/domains/pitches/services/locations.service.js";

const factory = createFactory();
const locationService = new LocationService();

export const fetchLocationsHandler = factory.createHandlers(
    async (c) => {
        const locations = await locationService.fetchLocations();
        return c.json({ success: true, data: { locations } }, 200);
    }
);
