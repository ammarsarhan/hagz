import { Request } from "express";
import { BaseTokenPayload } from "@/domains/jwt/jwt.service";
import { InternalServerError } from "@/shared/error";

export function requireUser(req: Request): asserts req is Request & { user: BaseTokenPayload } {
    if (!req.user) {
        throw new InternalServerError("User object has not been attached at the middleware level.")
    }
}
