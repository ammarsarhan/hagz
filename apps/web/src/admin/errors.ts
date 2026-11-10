import { errorMessage, isProblem } from "@hagz/api";

// openapi-fetch answers { data } or { error }, and throws when there was no answer (offline).
export type Result<T> = { ok: true; data: T } | { ok: false; error: unknown };

export const send = async <T>(
  request: Promise<{ data?: T; error?: unknown }>,
): Promise<Result<T>> => {
  try {
    const { data, error } = await request;
    return error === undefined ? { ok: true, data: data as T } : { ok: false, error };
  } catch (error) {
    return { ok: false, error };
  }
};

export const problemCode = (error: unknown) => (isProblem(error) ? error.code : undefined);

// The shared messages, in English. Admins sign in with an email, not the apps' phone number.
export const message = (error: unknown) =>
  problemCode(error) === "INVALID_CREDENTIALS"
    ? "That email and password don’t match."
    : errorMessage(error, "en");

// Whether a failure is the admin's to fix (a refused request: fixing the form is the way out) or
// not (no answer, or the server broke: the HUD offers Try again).
export const notTheirFault = (error: unknown) => !isProblem(error) || error.status >= 500;
