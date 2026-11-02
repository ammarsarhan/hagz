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
      forgotPassword: {
        phone: {
          title: "إعادة تعيين كلمة المرور",
          subtitle: "أدخل رقم موبايلك وسنرسل رمزًا على واتساب.",
        },
        warning: {
          title: "إعادة التعيين تجعلك للعرض فقط",
          subtitle: "هذا يحمي كل ملعب إذا انتقل رقمك إلى شخص آخر.",
          canView: "يمكنك العرض",
          canViewBody: "كل ما كان لديك صلاحية الوصول إليه من قبل.",
          cantChange: "لا يمكنك إجراء تغييرات",
          cantChangeBody: "حتى يعيد المالك صلاحياتك.",
          ownersTold: "يتم إبلاغ ملاك الملعب",
          ownersToldBody: "سيرون أنك أعدت تعيين كلمة المرور ويمكنهم إعادة صلاحياتك.",
          cancel: "إلغاء",
        },
        newPassword: {
          title: "اختر كلمة مرور جديدة",
          subtitle: "أدخل الرمز المرسل على واتساب إلى {{phone}}.",
          code: "الرمز",
          newPassword: "كلمة المرور الجديدة",
          submit: "إعادة تعيين كلمة المرور",
          ownerHint: "تملك ملعبًا؟ أرسلنا لك رسالة على واتساب بدلًا من الرمز.",
          ownerLink: "إعادة التعيين عبر الدعم",
        },
        support: {
          title: "إعادة التعيين عبر الدعم",
          subtitle:
            "لا يمكن للملاك إعادة تعيين كلمة المرور برمز. يتأكد فريقنا من هويتك أولًا ثم يساعدك على الدخول.",
          whyTitle: "لماذا لا يوجد رمز؟",
          whyBody:
            "يتحكم الملاك في المدفوعات ومن في الفريق. الرمز وحده ليس دليلًا كافيًا، خاصة إذا انتقل الرقم إلى شخص جديد.",
          whatTitle: "ماذا تفعل",
          whatBody: "رُد على رسالة واتساب التي أرسلناها لك للتو وسنتولى الأمر.",
          openWhatsApp: "فتح واتساب",
          backToSignIn: "العودة لتسجيل الدخول",
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
