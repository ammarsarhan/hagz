import { messaging } from "@/platform/messaging/messaging";
import type { createInMemoryProvider } from "@/platform/messaging/providers";

// Tests always get the in-memory provider (selectProvider picks it when NODE_ENV is test).
const inMemory = messaging as ReturnType<typeof createInMemoryProvider>;
if (!("sent" in inMemory)) throw new Error("Expected the in-memory messaging provider in tests");

// What the app "sent", so a test can read a code back like a user would.
export const outbox = inMemory;
