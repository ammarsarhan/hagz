import { createFactory } from "hono/factory";
import type { AppVariables } from "@/shared/types/context.js";
import { Language } from "@/generated/prisma/enums.js";

const factory = createFactory<{ Variables: AppVariables }>();

export const locale = factory.createMiddleware(async (c, next) => {
    const header = c.req.header('Accept-Language');
    const language = header?.startsWith('ar') ? Language.AR : Language.EN;

    c.set('locale', language);
    await next();
});
