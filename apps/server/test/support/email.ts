import { email } from "@/platform/email/email";
import type { createInMemoryProvider } from "@/platform/email/providers";

// Tests always get the in-memory provider (selectProvider picks it when NODE_ENV is test).
const inMemory = email as ReturnType<typeof createInMemoryProvider>;
if (!("sent" in inMemory)) throw new Error("Expected the in-memory email provider in tests");

// What the app "emailed", so a test can follow a link like the recipient would.
export const mailbox = inMemory;
