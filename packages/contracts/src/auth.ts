import { z } from "zod";

// International format; the API normalizes spaces, dashes and brackets and rejects landlines.
const Phone = z
  .string()
  .min(1)
  .max(32)
  .meta({ description: "Mobile number with its country code.", example: "+20 100 123 4567" });

export const SendVerificationCode = z.object({ phone: Phone }).meta({ id: "SendVerificationCode" });

export const VerificationCodeSent = z
  .object({
    expiresIn: z.int().meta({ description: "Seconds the code stays valid.", example: 600 }),
    resendAfter: z
      .int()
      .meta({ description: "Seconds before another code can be sent.", example: 60 }),
  })
  .meta({
    id: "VerificationCodeSent",
    description: "Returned whether or not the number has an account.",
  });

export const ConfirmVerificationCode = z
  .object({
    phone: Phone,
    code: z
      .string()
      .regex(/^\d{6}$/)
      .meta({ example: "482913" }),
  })
  .meta({ id: "ConfirmVerificationCode" });

export const VerificationConfirmed = z
  .object({
    verificationToken: z
      .string()
      .meta({ description: "Single use. Proves the phone belongs to the caller." }),
    expiresIn: z.int().meta({ example: 900 }),
  })
  .meta({ id: "VerificationConfirmed" });

export const CustomerSignUp = z
  .object({
    verificationToken: z.string().min(1),
    name: z.string().trim().min(1).max(100).meta({ example: "Ahmed" }),
    // NIST SP 800-63B: a minimum length, no composition rules, long passphrases allowed.
    password: z.string().min(8).max(128),
    timezone: z
      .string()
      .min(1)
      .max(64)
      .meta({ description: "The device's IANA time zone.", example: "Africa/Cairo" }),
  })
  .meta({ id: "CustomerSignUp" });

export const Session = z
  .object({
    accessToken: z.string(),
    accessTokenExpiresIn: z.int().meta({ description: "Seconds.", example: 600 }),
    refreshToken: z.string(),
    refreshTokenExpiresIn: z
      .int()
      .meta({ description: "Seconds; extended by every refresh.", example: 5184000 }),
  })
  .meta({ id: "Session" });

export const Customer = z
  .object({
    id: z.uuid(),
    name: z.string(),
    phone: z.string().meta({ example: "+201001234567" }),
    language: z.enum(["AR", "EN"]),
  })
  .meta({ id: "Customer" });

export const CustomerSignedUp = z
  .object({ customer: Customer, session: Session })
  .meta({ id: "CustomerSignedUp" });

export type SendVerificationCode = z.infer<typeof SendVerificationCode>;
export type VerificationCodeSent = z.infer<typeof VerificationCodeSent>;
export type ConfirmVerificationCode = z.infer<typeof ConfirmVerificationCode>;
export type VerificationConfirmed = z.infer<typeof VerificationConfirmed>;
export type CustomerSignUp = z.infer<typeof CustomerSignUp>;
export type Session = z.infer<typeof Session>;
export type Customer = z.infer<typeof Customer>;
export type CustomerSignedUp = z.infer<typeof CustomerSignedUp>;
