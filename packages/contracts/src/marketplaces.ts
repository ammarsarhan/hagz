import { z } from "zod";

export const Marketplace = z
  .object({
    code: z.string().length(2).meta({ description: "ISO 3166-1 alpha-2.", example: "EG" }),
    name: z.string().meta({ description: "In the requested language.", example: "مصر" }),
    currency: z.string().length(3).meta({ description: "ISO 4217.", example: "EGP" }),
    dialCode: z.string().meta({ description: "E.164 prefix.", example: "+20" }),
    timezone: z.string().meta({ description: "IANA time zone.", example: "Africa/Cairo" }),
  })
  .meta({ id: "Marketplace", description: "A country Hagz operates in." });

export type Marketplace = z.infer<typeof Marketplace>;
