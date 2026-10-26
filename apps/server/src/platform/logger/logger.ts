import { pino } from "pino";
import { env } from "@/platform/config/env";
import { currentContext } from "@/platform/context/request-context";

// Values that must never reach the logs, wherever they appear in a logged object (top level or one
// level down). Request bodies are never logged whole.
const secrets = ["password", "passwordHash", "refreshToken", "accessToken", "totpSecret", "phone"];

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { env: env.APP_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Every line written inside a request carries its id.
  mixin: () => {
    const context = currentContext();
    return context ? { requestId: context.requestId } : {};
  },
  redact: {
    paths: [
      ...secrets.flatMap((key) => [key, `*.${key}`]),
      "headers.authorization",
      "headers.cookie",
      'headers["set-cookie"]',
    ],
    censor: "[redacted]",
  },
  // JSON everywhere else, so Railway can parse it; readable lines locally.
  ...(env.NODE_ENV === "development" && { transport: { target: "pino-pretty" } }),
});
