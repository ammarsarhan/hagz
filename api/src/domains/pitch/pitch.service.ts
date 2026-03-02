import prisma from "@/shared/lib/prisma"

export default class PitchService {
    getAdminPermissions = async (id: string) => {
        const permissions = await prisma.staff.findMany({ 
            where: { userId: id },
            select: {
                userId: true,
                role: true,
                pitch: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            } 
        });

        return permissions;
    }
}