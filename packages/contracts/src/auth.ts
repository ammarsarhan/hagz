import { z } from "zod";

// International format; the API normalizes spaces, dashes and brackets and rejects landlines.
const Phone = z
  .string()
  .min(1)
  .max(32)
  .meta({ description: "Mobile number with its country code.", example: "+20 100 123 4567" });

const Code = z
  .string()
  .regex(/^\d{6}$/)
  .meta({ example: "482913" });
// NIST SP 800-63B: a minimum length, no composition rules, long passphrases allowed.
const Password = z.string().min(8).max(128);

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
    password: Password,
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

const Account = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string().meta({ example: "+201001234567" }),
  language: z.enum(["AR", "EN"]),
});

export const Customer = Account.meta({ id: "Customer" });
export const Staff = Account.meta({ id: "Staff" });

// Returned by sign-up and by sign-in.
export const CustomerAuthenticated = z
  .object({ customer: Customer, session: Session })
  .meta({ id: "CustomerAuthenticated" });

export const StaffSignUp = CustomerSignUp.omit({ timezone: true }).meta({ id: "StaffSignUp" });

export const StaffAuthenticated = z
  .object({ staff: Staff, session: Session })
  .meta({ id: "StaffAuthenticated" });

export const SignIn = z
  .object({ phone: Phone, password: z.string().min(1).max(128) })
  .meta({ id: "SignIn" });

export const RefreshSession = z
  .object({ refreshToken: z.string().min(1).max(256) })
  .meta({ id: "RefreshSession" });

export const RequestPasswordReset = z.object({ phone: Phone }).meta({ id: "RequestPasswordReset" });

export const ConfirmPasswordReset = z
  .object({ phone: Phone, code: Code, newPassword: Password })
  .meta({ id: "ConfirmPasswordReset" });

// Sign-in's answer when the account has two-factor on: the password was right, a code is on its way.
export const TwoFactorChallenge = z
  .object({
    twoFactorRequired: z.literal(true),
    challengeToken: z
      .string()
      .meta({ description: "Proves the password was right. Not an access token." }),
    expiresIn: z.int().meta({ example: 600 }),
    resendAfter: z.int().meta({ example: 60 }),
  })
  .meta({ id: "TwoFactorChallenge" });

export const CompleteTwoFactor = z
  .object({ challengeToken: z.string().min(1), code: Code })
  .meta({ id: "CompleteTwoFactor" });

export const ResendTwoFactor = z
  .object({ challengeToken: z.string().min(1) })
  .meta({ id: "ResendTwoFactor" });

export const ChangeTwoFactor = z
  .object({ enabled: z.boolean(), code: Code })
  .meta({ id: "ChangeTwoFactor", description: "Needs a code from POST two-factor/codes." });

export const TwoFactorStatus = z.object({ enabled: z.boolean() }).meta({ id: "TwoFactorStatus" });

export type SendVerificationCode = z.infer<typeof SendVerificationCode>;
export type VerificationCodeSent = z.infer<typeof VerificationCodeSent>;
export type ConfirmVerificationCode = z.infer<typeof ConfirmVerificationCode>;
export type VerificationConfirmed = z.infer<typeof VerificationConfirmed>;
export type CustomerSignUp = z.infer<typeof CustomerSignUp>;
export type Session = z.infer<typeof Session>;
export type Customer = z.infer<typeof Customer>;
export type CustomerAuthenticated = z.infer<typeof CustomerAuthenticated>;
export type StaffSignUp = z.infer<typeof StaffSignUp>;
export type Staff = z.infer<typeof Staff>;
export type StaffAuthenticated = z.infer<typeof StaffAuthenticated>;
export type SignIn = z.infer<typeof SignIn>;
export type RefreshSession = z.infer<typeof RefreshSession>;
export type RequestPasswordReset = z.infer<typeof RequestPasswordReset>;
export type ConfirmPasswordReset = z.infer<typeof ConfirmPasswordReset>;
export type TwoFactorChallenge = z.infer<typeof TwoFactorChallenge>;
export type CompleteTwoFactor = z.infer<typeof CompleteTwoFactor>;
export type ResendTwoFactor = z.infer<typeof ResendTwoFactor>;
export type ChangeTwoFactor = z.infer<typeof ChangeTwoFactor>;
export type TwoFactorStatus = z.infer<typeof TwoFactorStatus>;

// Admins: email and password, then an authenticator app, which is mandatory. Sessions are httpOnly
// cookies, never tokens in a response body.

const Email = z.email().max(254).meta({ example: "omar@hagz.app" });

export const AdminSignIn = z
  .object({ email: Email, password: z.string().min(1).max(128) })
  .meta({ id: "AdminSignIn" });

export const AdminChallenge = z
  .object({
    challengeToken: z
      .string()
      .meta({ description: "Proves the password was right. Single use. Not an access token." }),
    next: z.enum(["TOTP", "TOTP_SETUP"]).meta({
      description:
        "`TOTP`: ask for a code from the authenticator app. `TOTP_SETUP`: the account has no " +
        "authenticator yet; start the setup, then ask for its first code.",
    }),
    expiresIn: z.int().meta({ example: 600 }),
  })
  .meta({ id: "AdminChallenge" });

export const StartTotpSetup = z
  .object({ challengeToken: z.string().min(1) })
  .meta({ id: "StartTotpSetup" });

export const TotpSetup = z
  .object({
    secret: z.string().meta({ description: "Base32, for typing in by hand." }),
    otpauthUri: z.string().meta({ description: "Show as a QR code for the authenticator app." }),
  })
  .meta({ id: "TotpSetup" });

export const CompleteAdminSignIn = z
  .object({ challengeToken: z.string().min(1), code: Code })
  .meta({ id: "CompleteAdminSignIn" });

export const Admin = z
  .object({ id: z.uuid(), name: z.string(), email: z.string() })
  .meta({ id: "Admin" });

export const AdminSignedIn = z
  .object({
    admin: Admin,
    sessionExpiresIn: z
      .int()
      .meta({ description: "Seconds until the session ends; it isn't extended.", example: 43200 }),
  })
  .meta({ id: "AdminSignedIn" });

export const InviteAdmin = z.object({ email: Email }).meta({ id: "InviteAdmin" });

export const AdminInvitation = z
  .object({
    id: z.uuid(),
    email: z.string(),
    invitedBy: z.string().meta({ description: "The inviting admin's name." }),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: "AdminInvitation", description: "An invitation that hasn't been used or revoked." });

export const AcceptAdminInvitation = z
  .object({
    token: z.string().min(1).max(256).meta({ description: "From the invitation link." }),
    name: z.string().trim().min(1).max(100),
    password: Password,
  })
  .meta({ id: "AcceptAdminInvitation" });

export type AdminSignIn = z.infer<typeof AdminSignIn>;
export type AdminChallenge = z.infer<typeof AdminChallenge>;
export type StartTotpSetup = z.infer<typeof StartTotpSetup>;
export type TotpSetup = z.infer<typeof TotpSetup>;
export type CompleteAdminSignIn = z.infer<typeof CompleteAdminSignIn>;
export type Admin = z.infer<typeof Admin>;
export type AdminSignedIn = z.infer<typeof AdminSignedIn>;
export type InviteAdmin = z.infer<typeof InviteAdmin>;
export type AdminInvitation = z.infer<typeof AdminInvitation>;
export type AcceptAdminInvitation = z.infer<typeof AcceptAdminInvitation>;
