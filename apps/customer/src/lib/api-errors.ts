import { errorMessage, isProblem, shortErrorMessage, type Problem } from "@hagz/api";

// The customer app is English only until it gets its translations (like onboarding).
const LANGUAGE = "en";

// openapi-fetch answers { data } or { error }, and throws when there's no answer at all (offline).
// `send` folds all three into one shape, so screens handle every failure in one place.
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

export const problem = (error: unknown): Problem | undefined =>
  isProblem(error) ? error : undefined;

// For under a field: problems the person can fix.
export const fieldMessage = (error: unknown) => errorMessage(error, LANGUAGE);

// For the HUD: a few words, for problems that aren't the person's fault.
export const hudMessage = (error: unknown) => shortErrorMessage(error, LANGUAGE);
