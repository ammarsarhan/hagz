import { Request } from "express";
import { BaseTokenPayload } from "@/domains/token/token.service";
import { ForbiddenError, InternalServerError, NotFoundError, UnauthorizedError } from "@/shared/lib/error";
import { User } from "generated/prisma/client";

export function requireUser(req: Request): asserts req is Request & { user: BaseTokenPayload } {
    if (!req.user) {
        throw new InternalServerError("User object has not been attached at the middleware level.")
    }
};

export function authorizeDashboard(user: User | null) {
    if (!user) throw new NotFoundError("Could not find user with the specified ID.");
    if (!user.isVerified) throw new ForbiddenError("User account must be verified and active to access this resource.");
    if (user.role != "ADMIN") throw new UnauthorizedError("You does not have the specified permissions to access this resource.");
};
