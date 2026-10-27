import { ENVIRONMENTS, type Environment } from "@hagz/contracts";

// Which environment this deployment serves; decides the app ids deep links verify against.
const value = process.env.APP_ENV ?? "development";
if (!(ENVIRONMENTS as readonly string[]).includes(value)) {
  throw new Error(`Unknown APP_ENV: ${value}`);
}
export const appEnv = value as Environment;
