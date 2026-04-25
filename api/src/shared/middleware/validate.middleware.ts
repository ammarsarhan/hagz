import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { ZodType } from "zod";

const validate = <T>(target: Parameters<typeof zValidator>[0], schema: ZodType<T>) => 
    zValidator(target, schema, (result) => {
        if (!result.success) {
            throw new HTTPException(400, { cause: result.error });
        }
    });

export default validate;