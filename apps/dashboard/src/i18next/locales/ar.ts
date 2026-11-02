import type { Translations } from "./en";

// Arabic strings, with the same keys as en.ts (a missing translation is a type error). The
// onboarding lines are placeholders until the Arabic wordplay is decided.
const ar: Translations = {
  translation: {
    components: {
      shared: {
        nav: {
          back: "رجوع",
          close: "إغلاق",
        },
        passwordField: {
          show: "إظهار كلمة المرور",
          hide: "إخفاء كلمة المرور",
        },
        resendCode: {
          countdown: "إعادة إرسال الرمز بعد {{time}}",
          resend: "إعادة إرسال الرمز",
        },
      },
    },
    common: {
      actions: {
        continue: "متابعة",
        createAccount: "إنشاء حساب",
        signIn: "تسجيل الدخول",
        signOut: "تسجيل الخروج",
        sendCode: "إرسال الرمز",
        verify: "تحقق",
        change: "تغيير",
        forgotPassword: "نسيت كلمة المرور؟",
      },
      comingNext: "هذه الشاشة قادمة.",
      fields: {
        mobileNumber: "رقم الموبايل",
        fullName: "الاسم الكامل",
        fullNamePlaceholder: "اسمك",
        password: "كلمة المرور",
      },
    },
    screens: {
      onboarding: {
        schedules: {
          title: "مواعيدك المبعثرة، منظّمة.",
          body: "كل ملعب وكل حجز في تقويم واحد، من الحجز في المكان إلى الحجز أونلاين.",
        },
        money: {
          title: "فلوسك المتلخبطة، مضبوطة.",
          body: "المدفوعات أونلاين والعربون والكاش، في مكان واحد وتوصلك مستحقاتك.",
        },
        pitches: {
          title: "ملاعبك الفاضية، مليانة.",
          body: "اللاعبون في مدينتك يجدون ملعبك ويحجزون المواعيد المتاحة ويعودون كعملاء دائمين.",
        },
      },
      signUp: {
        phone: {
          title: "ما رقم موبايلك؟",
          subtitle: "سنرسل رمزًا على واتساب للتأكد من أنه رقمك.",
          terms: "بالمتابعة، أنت توافق على شروط حجز وسياسة الخصوصية.",
          invalid: "أدخل رقم موبايل صحيحًا.",
        },
        code: {
          title: "أدخل الرمز المكوّن من 6 أرقام",
          sentTo: "أُرسل على واتساب إلى {{phone}}.",
        },
        details: {
          title: "أعدّ حسابك",
          subtitle: "هكذا سيراك موظفوك وعملاؤك.",
          passwordRule: "8 أحرف على الأقل",
        },
        registered: {
          title: "لديك حساب بالفعل",
          body: "{{phone}} مسجل بالفعل على حجز. سجّل الدخول بدلًا من ذلك، أو أعد تعيين كلمة المرور إن نسيتها.",
        },
      },
      signIn: {
        title: "أهلًا بعودتك",
        subtitle: "سجّل الدخول برقم موبايلك وكلمة المرور.",
        twoFactor: {
          title: "رمز التحقق بخطوتين",
          subtitle: "أرسلنا رمزًا على واتساب إلى {{phone}}.",
        },
      },
      home: {
        title: "تم تسجيل دخولك",
      },
      components: {
        title: "المكونات",
        subtitle: "الأجزاء المشتركة في تطبيق الموظفين.",
        phoneTaken: "هذا الرقم مسجل بالفعل على حجز.",
        passwordTooShort: "استخدم 8 أحرف على الأقل.",
        codeWrong: "هذا الرمز غير صحيح.",
        tooManyTries: "محاولات كثيرة جدًا. انتظر قليلًا ثم حاول مرة أخرى.",
        couldntSendCode: "تعذّر إرسال الرمز",
        showHud: "عرض رسالة خطأ",
        openSheet: "فتح نافذة سفلية",
        invitationCodeTitle: "أدخل رمز الدعوة",
        invitationCodeSubtitle: "الرمز المكوّن من 6 خانات في الدعوة التي أرسلها المالك.",
        createVenue: "أنشئ ملعبك",
        haveCode: "لديك رمز؟",
      },
    },
  },
};

export default ar;
