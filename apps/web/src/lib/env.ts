import { ENVIRONMENTS, type Environment } from "@hagz/contracts";

// Which environment this deployment serves; decides the app ids deep links verify against.
const value = process.env.APP_ENV ?? "development";
if (!(ENVIRONMENTS as readonly string[]).includes(value)) {
  throw new Error(`Unknown APP_ENV: ${value}`);
}
export const appEnv = value as Environment;

// The API, for server-side requests (the browser reaches it through this site's /v1, next.config.ts).
export const apiUrl = (process.env.API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
