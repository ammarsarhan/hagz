import { parseEnvironment } from "@hagz/contracts";

export const appEnv = parseEnvironment(process.env.APP_ENV);
