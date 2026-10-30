import type { Language } from "./client";
import type { components } from "./generated/openapi";

export type Problem = components["schemas"]["Problem"];

// What to show a person for each code the API returns (packages/contracts problem.ts: clients
// switch on `code`, never on `detail`, which is English and written for developers). A screen that
// handles a code itself (INVALID_CREDENTIALS next to the password field, APP_UPDATE_REQUIRED as a
// full-screen prompt) can still use these as its text.
const messages = {
  // Requests
  BAD_REQUEST: {
    en: "Something about that request wasn't right. Please try again.",
    ar: "حدث خطأ في الطلب. حاول مرة أخرى.",
  },
  VALIDATION_FAILED: {
    en: "Some of the details aren't valid. Check them and try again.",
    ar: "بعض البيانات غير صحيحة. راجعها وحاول مرة أخرى.",
  },
  NOT_FOUND: { en: "We couldn't find that.", ar: "لم نعثر على ما تبحث عنه." },
  PAYLOAD_TOO_LARGE: { en: "That's too large to send.", ar: "الملف أو البيانات كبيرة جدًا." },
  RATE_LIMITED: {
    en: "Too many attempts. Please wait a moment and try again.",
    ar: "محاولات كثيرة جدًا. انتظر قليلًا ثم حاول مرة أخرى.",
  },
  SERVICE_UNAVAILABLE: {
    en: "Hagz is having trouble right now. Please try again in a moment.",
    ar: "يواجه حجز مشكلة حاليًا. حاول مرة أخرى بعد قليل.",
  },
  INTERNAL_ERROR: {
    en: "Something went wrong on our side. Please try again.",
    ar: "حدث خطأ من جهتنا. حاول مرة أخرى.",
  },
  APP_UPDATE_REQUIRED: {
    en: "This version of the app is no longer supported. Please update it.",
    ar: "هذا الإصدار من التطبيق لم يعد مدعومًا. يرجى تحديثه.",
  },
  IDEMPOTENCY_KEY_REUSED: {
    en: "Something went wrong. Please start again.",
    ar: "حدث خطأ ما. يرجى البدء من جديد.",
  },

  // Signing in
  UNAUTHENTICATED: { en: "Please sign in to continue.", ar: "سجّل الدخول للمتابعة." },
  TOKEN_EXPIRED: { en: "Please sign in to continue.", ar: "سجّل الدخول للمتابعة." },
  SESSION_ENDED: {
    en: "You've been signed out. Please sign in again.",
    ar: "تم تسجيل خروجك. سجّل الدخول مرة أخرى.",
  },
  INVALID_CREDENTIALS: {
    en: "That phone number and password don't match.",
    ar: "رقم الهاتف وكلمة المرور غير متطابقين.",
  },
  ACCOUNT_SUSPENDED: {
    en: "This account has been suspended. Contact support for help.",
    ar: "تم إيقاف هذا الحساب. تواصل مع الدعم للمساعدة.",
  },
  INVALID_PHONE_NUMBER: {
    en: "Enter a valid mobile number with its country code.",
    ar: "أدخل رقم هاتف محمول صحيحًا مع رمز الدولة.",
  },
  PHONE_ALREADY_REGISTERED: {
    en: "This number already has an account. Sign in instead.",
    ar: "يوجد حساب بهذا الرقم بالفعل. سجّل الدخول بدلًا من ذلك.",
  },

  // Codes
  INVALID_CODE: { en: "That code isn't right.", ar: "الرمز غير صحيح." },
  CODE_EXPIRED: {
    en: "That code has expired. Ask for a new one.",
    ar: "انتهت صلاحية الرمز. اطلب رمزًا جديدًا.",
  },
  CHALLENGE_EXPIRED: {
    en: "That took too long. Please sign in again.",
    ar: "انتهت المهلة. سجّل الدخول مرة أخرى.",
  },
  VERIFICATION_TOKEN_INVALID: {
    en: "Your phone verification has expired. Please verify your number again.",
    ar: "انتهت صلاحية التحقق من رقمك. تحقق منه مرة أخرى.",
  },
  MESSAGING_UNAVAILABLE: {
    en: "We couldn't send the code right now. Please try again in a moment.",
    ar: "تعذّر إرسال الرمز حاليًا. حاول مرة أخرى بعد قليل.",
  },
  EMAIL_UNAVAILABLE: {
    en: "We couldn't send the email right now. Please try again in a moment.",
    ar: "تعذّر إرسال البريد الإلكتروني حاليًا. حاول مرة أخرى بعد قليل.",
  },

  // Admins
  ADMIN_HEADER_REQUIRED: {
    en: "Something went wrong. Please reload the page.",
    ar: "حدث خطأ ما. أعد تحميل الصفحة.",
  },
  ADMIN_ALREADY_EXISTS: {
    en: "An admin with this email already exists.",
    ar: "يوجد مسؤول بهذا البريد الإلكتروني بالفعل.",
  },
  TOTP_SETUP_REQUIRED: {
    en: "Set up your authenticator app to continue.",
    ar: "أعدّ تطبيق المصادقة للمتابعة.",
  },
  TOTP_ALREADY_SET_UP: {
    en: "Your authenticator app is already set up.",
    ar: "تطبيق المصادقة مُعدّ بالفعل.",
  },

  // Invitations and venues
  INVITATION_NOT_FOUND: {
    en: "We couldn't find this invitation.",
    ar: "لم نعثر على هذه الدعوة.",
  },
  INVITATION_INVALID: {
    en: "This invitation is no longer valid.",
    ar: "هذه الدعوة لم تعد صالحة.",
  },
  INVITATION_EXPIRED: {
    en: "This invitation has expired. Ask for a new one.",
    ar: "انتهت صلاحية هذه الدعوة. اطلب دعوة جديدة.",
  },
  INVITATION_ALREADY_ACCEPTED: {
    en: "This invitation has already been accepted.",
    ar: "تم قبول هذه الدعوة بالفعل.",
  },
  ALREADY_A_MEMBER: {
    en: "You're already a member of this venue.",
    ar: "أنت عضو في هذا الملعب بالفعل.",
  },
  VENUE_NOT_FOUND: { en: "We couldn't find this venue.", ar: "لم نعثر على هذا الملعب." },
  MEMBER_NOT_FOUND: {
    en: "This person isn't a member of the venue.",
    ar: "هذا الشخص ليس عضوًا في الملعب.",
  },
  PERMISSION_DENIED: {
    en: "You don't have permission to do this.",
    ar: "ليست لديك صلاحية للقيام بذلك.",
  },
  PERMISSION_ABOVE_YOUR_OWN: {
    en: "You can't give someone more access than you have.",
    ar: "لا يمكنك منح أحد صلاحيات أعلى من صلاحياتك.",
  },
  NOTHING_TO_RESTORE: {
    en: "There are no previous permissions to restore.",
    ar: "لا توجد صلاحيات سابقة لاستعادتها.",
  },
} as const satisfies Record<string, Record<Language, string>>;

export type ProblemCode = keyof typeof messages;

const offline = {
  en: "Couldn't reach Hagz. Check your connection and try again.",
  ar: "تعذّر الاتصال بحجز. تحقق من اتصالك وحاول مرة أخرى.",
} as const;

export const isProblem = (value: unknown): value is Problem =>
  typeof value === "object" &&
  value !== null &&
  "code" in value &&
  typeof value.code === "string" &&
  "status" in value;

// For anything a request can fail with: the `error` openapi-fetch returns (a Problem), or what it
// throws when the request never got an answer (no connection, DNS, a dropped socket).
export const errorMessage = (error: unknown, language: Language): string => {
  if (!isProblem(error)) return offline[language];
  const code = Object.hasOwn(messages, error.code) ? (error.code as ProblemCode) : "INTERNAL_ERROR";
  return messages[code][language];
};
