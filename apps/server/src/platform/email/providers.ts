import { AppError } from "@/platform/errors/app-error";
import { logger } from "@/platform/logger/logger";
import type { AdminInvitationEmail, EmailProvider } from "./email-provider";

// Development: the email goes to the console, so invitations work without an email account. Never
// used outside development: an invitation link in deployed logs lets anyone who reads them become an
// admin.
export const consoleProvider: EmailProvider = {
  sendAdminInvitation: ({ to, invitedBy, acceptUrl, expiresAt }) => {
    logger.info(
      { to, invitedBy, acceptUrl, expiresAt },
      "admin invitation email (development: not sent)",
    );
    return Promise.resolve();
  },
};

// Tests: keeps what was sent, so a test can follow the link like the recipient would.
export const createInMemoryProvider = () => {
  const sent: AdminInvitationEmail[] = [];
  return {
    sent,
    sendAdminInvitation: (email: AdminInvitationEmail) => {
      sent.push(email);
      return Promise.resolve();
    },
    lastInvitationTo: (to: string) => sent.findLast((email) => email.to === to),
  } satisfies EmailProvider & Record<string, unknown>;
};

// Staging and production until a provider is chosen: fail visibly instead of pretending to send.
export const unconfiguredProvider: EmailProvider = {
  sendAdminInvitation: () =>
    Promise.reject(
      new AppError({
        code: "EMAIL_UNAVAILABLE",
        status: 503,
        detail: "Emails can't be sent right now. Please try again later.",
      }),
    ),
};
