import type { Language } from "@/generated/prisma/enums";

// An adapter to whoever delivers messages to phones (Meta's WhatsApp Business Cloud API), like
// PaymentProvider is for payments. Sign-in codes use it now; notifications will add templates.
export interface MessagingProvider {
  // A one-time code to an E.164 number, in that language's approved authentication template.
  sendVerificationCode(message: VerificationCodeMessage): Promise<void>;
  // An invitation to join a venue's staff, with the link that opens it in the dashboard app.
  sendStaffInvitation(message: StaffInvitationMessage): Promise<void>;
  // To a venue owner who asked for a password reset: owners get no code, so this says they reset
  // with Hagz support and can reply in this same chat. Only the number's holder sees it, so it
  // tells them their path without the app (or anyone) learning the number belongs to an owner.
  sendSupportResetNotice(message: SupportResetNoticeMessage): Promise<void>;
}

export interface SupportResetNoticeMessage {
  phone: string;
  language: Language;
}

export interface VerificationCodeMessage {
  phone: string;
  code: string;
  language: Language;
}

export interface StaffInvitationMessage {
  phone: string;
  venueName: string;
  invitedBy: string;
  link: string;
  language: Language;
}
