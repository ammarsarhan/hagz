import { problemResponse } from "@/platform/http/definitions";

// Responses the customer and staff auth routes share.
export const unauthenticated = problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED");
export const unavailable = problemResponse(
  "SERVICE_UNAVAILABLE or MESSAGING_UNAVAILABLE: retry later.",
);
export const codeRejected = problemResponse("INVALID_CODE (with `attemptsLeft`) or CODE_EXPIRED");
