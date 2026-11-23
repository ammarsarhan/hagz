import { AppError } from "@/platform/errors/app-error";

// A page's place in a list ordered by when it starts, then id: the last row shown, as an opaque
// token (my bookings, my games).

const invalidCursor = () =>
  new AppError({
    code: "INVALID_CURSOR",
    status: 400,
    detail: "That page link has expired. Load the list again.",
  });

export interface Cursor {
  startsAt: Date;
  id: string;
}

export const encodeCursor = ({ startsAt, id }: Cursor) =>
  Buffer.from(JSON.stringify([startsAt.toISOString(), id])).toString("base64url");

export const decodeCursor = (text: string): Cursor => {
  try {
    const [startsAt, id] = JSON.parse(Buffer.from(text, "base64url").toString()) as unknown[];
    if (typeof startsAt !== "string" || typeof id !== "string") throw new Error("Malformed.");
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) throw new Error("Malformed.");
    return { startsAt: date, id };
  } catch {
    throw invalidCursor();
  }
};
