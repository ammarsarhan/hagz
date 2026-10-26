import { z } from "zod";

// Every list response is an object, never a bare array, so fields such as a pagination cursor can be
// added later without breaking app builds already installed. The item schema is the named model;
// the wrapper stays inline. A page() with `nextCursor` comes with the first paginated list.
export const list = <Item extends z.ZodType>(item: Item) => z.object({ data: z.array(item) });
