import { z } from "zod";

// Every list response is an object, never a bare array, so fields such as a pagination cursor can be
// added later without breaking app builds already installed. The item schema is the named model;
// the wrapper stays inline.
export const list = <Item extends z.ZodType>(item: Item) => z.object({ data: z.array(item) });

// A list too long to send at once. `nextCursor` goes back as `cursor` for the next page; null on the
// last one. Cursors are opaque to clients.
export const page = <Item extends z.ZodType>(item: Item) =>
  z.object({
    data: z.array(item),
    nextCursor: z.string().nullable().meta({ description: "Null on the last page." }),
  });
