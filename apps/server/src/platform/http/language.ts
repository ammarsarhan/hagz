import type { Context } from "hono";
import { accepts } from "hono/accepts";
import type { Language } from "@/generated/prisma/enums";

// The language a request asks for (Accept-Language: ar or en), Arabic by default, like
// Customer.language.
export const requestLanguage = (c: Context): Language =>
  accepts(c, { header: "Accept-Language", supports: ["ar", "en"], default: "ar" }) === "en"
    ? "EN"
    : "AR";
