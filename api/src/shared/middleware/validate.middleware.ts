import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { ZodType } from "zod";
import type { ValidationTargets } from "hono";

const validate = <
  T extends ZodType<any, any, any>,
  Target extends keyof ValidationTargets
>(
  target: Target,
  schema: T
) => 
    zValidator(target, schema, (result) => {
        if (!result.success) {
            throw new HTTPException(400, { cause: result.error });
        }
    });

export default validate;