import { env } from "@/platform/config/env";
import type { EmailProvider } from "./email-provider";
import { consoleProvider, createInMemoryProvider, unconfiguredProvider } from "./providers";

export const selectProvider = ({
  NODE_ENV,
  APP_ENV,
}: Pick<typeof env, "NODE_ENV" | "APP_ENV">): EmailProvider => {
  if (NODE_ENV === "test") return createInMemoryProvider();
  if (APP_ENV === "development") return consoleProvider;
  return unconfiguredProvider;
};

// The provider for this process, chosen once from the environment.
export const email = selectProvider(env);
