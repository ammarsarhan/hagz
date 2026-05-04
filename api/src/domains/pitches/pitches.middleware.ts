import { createFactory } from "hono/factory";

import { authorize } from "@/domains/auth/auth.middleware.js";

import prisma from "@/shared/lib/prisma.js";
import type { AppVariables } from "@/shared/types/context.js";
import { ERROR_CODES, ForbiddenError } from "@/shared/lib/error.js";

const factory = createFactory<{ Variables: AppVariables }>();

const guard = factory.createMiddleware(async (c, next) => {
    // Pass an empty function to authorize middleware to stop it from skipping early.
    await authorize(c, async () => {});

    // Run the authorize middleware first to fetch the userId and then get that user's permissions.
    const userId = c.var.id;
    const pitchId = c.req.param("pitchId");

    const pitches = await prisma.staff.findMany({
        where: {
            userId
        }
    });

    const target = pitches.find(item => item.pitchId === pitchId);

    // If that user's permissions do not contain any record of that pitch within the Staff model then they are not allowed to move forward.
    if (!target) throw new ForbiddenError("You are not allowed to access this resource.", ERROR_CODES.PITCH_ACCESS_FORBIDDEN);

    // If they are allowed to access, pass down their permissions and move forward.
    const data = {
        pitchId: target.pitchId,
        role: target.role,
        permissions: target.permissions
    };

    c.set("pitches", data);

    await next();
});

export default guard;