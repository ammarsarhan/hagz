import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import type {
  MessagingProvider,
  StaffInvitationMessage,
  VerificationCodeMessage,
} from "./messaging-provider";

// Development: the code goes to the console, so sign-up works without a WhatsApp account. Never
// used outside development: a code in deployed logs lets anyone who can read them sign in.
export const consoleProvider: MessagingProvider = {
  sendVerificationCode: ({ phone, code, language }) => {
    logger.info({ to: phone, code, language }, "verification code (development: not sent)");
    return Promise.resolve();
  },
  sendStaffInvitation: ({ phone, venueName, invitedBy, link, language }) => {
    logger.info(
      { to: phone, venueName, invitedBy, link, language },
      "staff invitation (development: not sent)",
    );
    return Promise.resolve();
  },
};

// Tests: keeps what was sent, so a test can read the code back like a user would.
export const createInMemoryProvider = () => {
  const sent: VerificationCodeMessage[] = [];
  const invitations: StaffInvitationMessage[] = [];
  return {
    sent,
    invitations,
    sendVerificationCode: (message: VerificationCodeMessage) => {
      sent.push(message);
      return Promise.resolve();
    },
    sendStaffInvitation: (message: StaffInvitationMessage) => {
      invitations.push(message);
      return Promise.resolve();
    },
    lastCodeFor: (phone: string) => sent.findLast((message) => message.phone === phone)?.code,
    lastInvitationTo: (phone: string) => invitations.findLast((message) => message.phone === phone),
  } satisfies MessagingProvider & Record<string, unknown>;
};

// Staging and production until Meta's API is wired in: fail visibly instead of pretending to send.
const unavailable = () =>
  Promise.reject(
    new AppError({
      code: "MESSAGING_UNAVAILABLE",
      status: 503,
      detail: "WhatsApp messages can't be sent right now. Please try again later.",
    }),
  );

export const unconfiguredProvider: MessagingProvider = {
  sendVerificationCode: unavailable,
  sendStaffInvitation: unavailable,
};
