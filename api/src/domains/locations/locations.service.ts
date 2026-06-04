import prisma from "@/shared/lib/utils/prisma.js";

export default class LocationService {
    fetchLocations = async () => {
        const locations = await prisma.governorate.findMany({
            include: {
                areas: {
                    orderBy: {
                        name: 'asc'
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return locations;
    };
}
