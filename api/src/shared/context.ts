import type { AccessTokenPayload } from "@/domains/tokens/jwt.service.js";
import type { PitchPermissionsType } from "@/domains/pitches/pitches.validator.js";

export type AppVariables = AccessTokenPayload & { permissions: PitchPermissionsType };
