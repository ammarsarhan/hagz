// The typed client for the Hagz API, shared by the Expo apps and the web app. Its types are generated
// from apps/server/openapi.json (`pnpm --filter @hagz/api generate`), so a change to the API
// shows up here as a type error in the screen that depends on it.
export * from "./client";
export * from "./errors";
export type { components, paths } from "./generated/openapi";
