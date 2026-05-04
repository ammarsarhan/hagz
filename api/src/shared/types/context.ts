import type { AccessTokenPayload } from "@/domains/tokens/jwt.service.js";
import type { StaffType } from "@/domains/pitches/pitches.validator.js";

export type AppVariables = AccessTokenPayload & { pitches: StaffType };
