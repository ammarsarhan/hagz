import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import type { MessagingProvider, VerificationCodeMessage } from "./messaging-provider";

// Development: the code goes to the console, so sign-up works without a WhatsApp account. Never
// used outside development: a code in deployed logs lets anyone who can read them sign in.
export const consoleProvider: MessagingProvider = {
  sendVerificationCode: ({ phone, code, language }) => {
    logger.info({ to: phone, code, language }, "verification code (development: not sent)");
    return Promise.resolve();
  },
};

// Tests: keeps what was sent, so a test can read the code back like a user would.
export const createInMemoryProvider = () => {
  const sent: VerificationCodeMessage[] = [];
  return {
    sent,
    sendVerificationCode: (message: VerificationCodeMessage) => {
      sent.push(message);
      return Promise.resolve();
    },
    lastCodeFor: (phone: string) => sent.findLast((message) => message.phone === phone)?.code,
  } satisfies MessagingProvider & Record<string, unknown>;
};

// Staging and production until Meta's API is wired in: fail visibly instead of pretending to send.
export const unconfiguredProvider: MessagingProvider = {
  sendVerificationCode: () =>
    Promise.reject(
      new AppError({
        code: "MESSAGING_UNAVAILABLE",
        status: 503,
        detail: "Verification codes can't be sent right now. Please try again later.",
      }),
    ),
};
