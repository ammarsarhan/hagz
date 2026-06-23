import { createFactory } from "hono/factory";

import { authorize } from "@/domains/auth/auth.middleware.js";

import prisma from "@/shared/lib/utils/prisma.js";
import type { AppVariables } from "@/shared/types/context.js";
import { ERROR_CODES, ForbiddenError } from "@/shared/lib/utils/error.js";
import { PermissionLevel, StaffRole } from "@/generated/prisma/enums.js";
import type { PermissionDomain, Permissions } from "@/shared/types/staff.js";

const factory = createFactory<{ Variables: AppVariables }>();

const hierarchy: Record<PermissionLevel, number> = {
    [PermissionLevel.NONE]: 0,
    [PermissionLevel.READ]: 1,
    [PermissionLevel.WRITE]: 2
};

const guard = (domain: PermissionDomain, level: PermissionLevel = PermissionLevel.READ) =>
    factory.createMiddleware(async (c, next) => {
        // Pass an empty function to authorize middleware to stop it from skipping early.
        await authorize()(c, async () => {});

        // Run the authorize middleware first to fetch the userId and then get that user's permissions.
        const userId = c.var.id;
        const pitchId = c.req.param("pitchId");

        const staff = await prisma.staff.findFirst({
            where: {
                userId,
                pitchId
            }
        });

        // If that user's permissions do not contain any record of that pitch within the Staff model then they are not allowed to move forward.
        if (!staff) throw new ForbiddenError("You are not allowed to access this resource.", ERROR_CODES.PITCH_ACCESS_FORBIDDEN);

        const data = {
            pitchId: staff.pitchId,
            role: staff.role,
            permissions: staff.permissions
        };

        // Skip the permissions check if they are an owner because granular permission check is not necessary.
        if (staff.role === StaffRole.OWNER) {
            c.set("pitches", data);
            return await next();
        };

        const permissions = staff.permissions as Permissions;

        const currentLevel = permissions[domain];
        const requiredLevel = level;

        // Compare against hierarchy map to make sure they have the bare minimum requirement to access the domain.
        if (hierarchy[currentLevel] < hierarchy[requiredLevel]) {
            throw new ForbiddenError(`You do not have ${requiredLevel.toLowerCase()} access to ${domain.toLowerCase()}.`, ERROR_CODES.PITCH_ACCESS_FORBIDDEN);
        };

        // If they are allowed to access, pass down their permissions and move forward.
        c.set("pitches", data);
        await next();
    });

export default guard;