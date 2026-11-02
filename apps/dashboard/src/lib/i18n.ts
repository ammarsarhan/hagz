import { language } from "./language";

// Every string the app shows, in English and Arabic. Arabic must have exactly the same keys, so a
// missing translation is a type error rather than a blank on screen. Western digits in both.
const en = {
  back: "Back",
  close: "Close",
  showPassword: "Show password",
  hidePassword: "Hide password",
  componentsTitle: "Components",
  componentsSubtitle: "Shared pieces of the staff app, live.",
  mobileNumber: "Mobile number",
  fullName: "Full name",
  fullNamePlaceholder: "Your name",
  password: "Password",
  passwordTooShort: "Use at least 8 characters.",
  phoneTaken: "This number is already on Hagz.",
  createAccount: "Create account",
  createVenue: "Create your venue",
  haveCode: "Have a code?",
  continue: "Continue",
  signIn: "Sign in",
  onboarding1Title: "Scattered schedules, sorted.",
  onboarding1Body:
    "Every pitch and every booking on one calendar, from walk-ins to online bookings.",
  onboarding2Title: "Messy money, managed.",
  onboarding2Body: "Online payments, deposits and cash, tracked in one place and paid out to you.",
  onboarding3Title: "Empty pitches, packed.",
  onboarding3Body:
    "Players across your city find your venue, book open slots and come back as regulars.",
  comingNext: "This screen comes next.",
  codeWrong: "That code isn't right.",
  tooManyTries: "Too many attempts. Please wait a moment and try again.",
  couldntSendCode: "Couldn't send the code",
  showHud: "Show an error HUD",
  openSheet: "Open a sheet",
  invitationCodeTitle: "Enter your invitation code",
  invitationCodeSubtitle: "The 6-character code from the invitation the owner sent you.",
};

const ar: Record<keyof typeof en, string> = {
  back: "رجوع",
  close: "إغلاق",
  showPassword: "إظهار كلمة المرور",
  hidePassword: "إخفاء كلمة المرور",
  componentsTitle: "المكونات",
  componentsSubtitle: "الأجزاء المشتركة في تطبيق الموظفين.",
  mobileNumber: "رقم الموبايل",
  fullName: "الاسم الكامل",
  fullNamePlaceholder: "اسمك",
  password: "كلمة المرور",
  passwordTooShort: "استخدم 8 أحرف على الأقل.",
  phoneTaken: "هذا الرقم مسجل بالفعل على حجز.",
  createAccount: "إنشاء حساب",
  createVenue: "أنشئ ملعبك",
  haveCode: "لديك رمز؟",
  continue: "متابعة",
  signIn: "تسجيل الدخول",
  onboarding1Title: "مواعيدك المبعثرة، منظّمة.",
  onboarding1Body: "كل ملعب وكل حجز في تقويم واحد، من الحجز في المكان إلى الحجز أونلاين.",
  onboarding2Title: "فلوسك المتلخبطة، مضبوطة.",
  onboarding2Body: "المدفوعات أونلاين والعربون والكاش، في مكان واحد وتوصلك مستحقاتك.",
  onboarding3Title: "ملاعبك الفاضية، مليانة.",
  onboarding3Body: "اللاعبون في مدينتك يجدون ملعبك ويحجزون المواعيد المتاحة ويعودون كعملاء دائمين.",
  comingNext: "هذه الشاشة قادمة.",
  codeWrong: "هذا الرمز غير صحيح.",
  tooManyTries: "محاولات كثيرة جدًا. انتظر قليلًا ثم حاول مرة أخرى.",
  couldntSendCode: "تعذّر إرسال الرمز",
  showHud: "عرض رسالة خطأ",
  openSheet: "فتح نافذة سفلية",
  invitationCodeTitle: "أدخل رمز الدعوة",
  invitationCodeSubtitle: "الرمز المكوّن من 6 خانات في الدعوة التي أرسلها المالك.",
};

export type MessageKey = keyof typeof en;

const messages = { en, ar }[language];

export const t = (key: MessageKey): string => messages[key];
