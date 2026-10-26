import type { Language } from "@/generated/prisma/enums";

// An adapter to whoever delivers messages to phones (Meta's WhatsApp Business Cloud API), like
// PaymentProvider is for payments. Sign-in codes use it now; notifications will add templates.
export interface MessagingProvider {
  // A one-time code to an E.164 number, in that language's approved authentication template.
  sendVerificationCode(message: VerificationCodeMessage): Promise<void>;
}

export interface VerificationCodeMessage {
  phone: string;
  code: string;
  language: Language;
}
