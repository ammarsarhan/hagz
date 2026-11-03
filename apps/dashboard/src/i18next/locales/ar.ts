import type { ArabicTranslations } from "./en";

// Arabic strings, with the same keys as en.ts (a missing translation is a type error) plus Arabic's
// extra plural forms. The onboarding lines are placeholders until the Arabic wordplay is decided.
const ar: ArabicTranslations = {
  translation: {
    components: {
      invitationCard: {
        invitedBy: "دعاك {{name}}",
        grounds_zero: "لا ملاعب",
        grounds_one: "ملعب واحد",
        grounds_two: "ملعبان",
        grounds_few: "{{count}} ملاعب",
        grounds_many: "{{count}} ملعبًا",
        grounds_other: "{{count}} ملعب",
        staff_zero: "لا موظفين",
        staff_one: "موظف واحد",
        staff_two: "موظفان",
        staff_few: "{{count}} موظفين",
        staff_many: "{{count}} موظفًا",
        staff_other: "{{count}} موظف",
        decline: "رفض",
        join: "انضمام",
        expiresIn_zero: "تنتهي خلال أقل من ساعة",
        expiresIn_one: "تنتهي خلال ساعة",
        expiresIn_two: "تنتهي خلال ساعتين",
        expiresIn_few: "تنتهي خلال {{count}} ساعات",
        expiresIn_many: "تنتهي خلال {{count}} ساعة",
        expiresIn_other: "تنتهي خلال {{count}} ساعة",
        expiresSoon: "تنتهي خلال الساعة",
      },
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
        contactSupport: "تواصل مع الدعم",
        backToSignIn: "العودة لتسجيل الدخول",
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
      account: {
        open: "حسابك",
        security: "الأمان",
        app: "التطبيق",
        twoFactor: {
          title: "التحقق بخطوتين",
          off: "رمز على واتساب في كل مرة تسجّل فيها الدخول.",
          on: "مفعّل: رمز على واتساب عند كل تسجيل دخول.",
          turnOnTitle: "تفعيل التحقق بخطوتين",
          turnOffTitle: "إيقاف التحقق بخطوتين",
          subtitle: "أدخل الرمز الذي أرسلناه على واتساب إلى {{phone}}.",
          turnOn: "تفعيل",
          turnOff: "إيقاف",
        },
        password: {
          title: "كلمة المرور",
          body: "أعد تعيينها برمز على واتساب.",
        },
        language: {
          title: "اللغة",
          body: "{{language}}، من إعدادات هاتفك.",
          en: "الإنجليزية",
          ar: "العربية",
        },
        support: {
          body: "راسل فريق Hagz على واتساب.",
        },
        signOut: {
          title: "تسجيل الخروج؟",
          body: "ستسجّل الدخول مجددًا برقمك وكلمة المرور. تبقى ملاعبك ودعواتك كما هي.",
          cancel: "إلغاء",
        },
        version: "Hagz للموظفين · {{version}}",
      },
      firstRun: {
        welcome: "أهلًا، {{name}}",
        invitedSubtitle_zero: "تمت دعوتك للانضمام إلى ملعب.",
        invitedSubtitle_one: "تمت دعوتك للانضمام إلى ملعب.",
        invitedSubtitle_two: "تمت دعوتك للانضمام إلى ملعبين.",
        invitedSubtitle_few: "تمت دعوتك للانضمام إلى {{count}} ملاعب.",
        invitedSubtitle_many: "تمت دعوتك للانضمام إلى {{count}} ملعبًا.",
        invitedSubtitle_other: "تمت دعوتك للانضمام إلى {{count}} ملعب.",
        emptySubtitle: "أعدّ ملعبك لتبدأ في استقبال الحجوزات.",
        invitations: "الدعوات · {{count}}",
        moreWays: "طرق أخرى للبدء",
        createVenueTitle: "أنشئ ملعبك",
        createVenueTileBody: "ملاعبك ومواعيدك وأسعارك.",
        createVenueBody: "أضف ملاعبك ومواعيدك وأسعارك. يراجعه فريقنا قبل نشره.",
        joiningTitle: "تنضم إلى ملعب شخص آخر؟",
        joiningBody: "اطلب من المالك دعوة {{phone}}. ستظهر الدعوة هنا.",
        haveCode: "لديك رمز؟",
        haveCodeBody: "انضم بالرمز الذي أرسله لك المالك.",
        profile: "ملفك الشخصي",
        retry: "حاول مرة أخرى",
      },
      invitation: {
        title: "انضم إلى {{venue}}",
        subtitle: "دعاك {{name}} للانضمام إلى الفريق. هذه صلاحياتك، ويمكن للمالك تغييرها لاحقًا.",
        areas: {
          bookings: "الحجوزات",
          customers: "العملاء",
          schedule: "المواعيد والأسعار",
          payments: "المدفوعات",
          finance: "المالية",
          staff: "الفريق",
          venue: "ملف الملعب",
        },
        levels: {
          manage: "إدارة",
          view: "عرض فقط",
          none: "بدون صلاحية",
        },
        join: "انضم إلى الملعب",
        decline: "رفض",
        ended: {
          title: "انتهت هذه الدعوة",
          body: "انتهت صلاحيتها أو أُلغيت أو استُخدمت بالفعل. اطلب من {{name}} إرسال دعوة جديدة.",
          bodyNoName:
            "انتهت صلاحيتها أو أُلغيت أو استُخدمت بالفعل. اطلب من المالك إرسال دعوة جديدة.",
          gotIt: "حسنًا",
        },
        member: {
          title: "أنت في الفريق بالفعل",
          body: "أنت عضو في {{venue}}، فلا يوجد ما تقبله.",
          open: "افتح {{venue}}",
        },
      },
      haveCode: {
        wrong: "لا توجد دعوة لرقمك بهذا الرمز.",
        title: "أدخل رمز الدعوة",
        subtitle: "الرمز المكوّن من 6 خانات في الدعوة التي أرسلها المالك إلى {{phone}}.",
      },
      venueHome: {
        subtitle: "الصفحة الرئيسية لملعبك قادمة.",
      },
      blocked: {
        suspended: {
          title: "حسابك موقوف",
          body: "لا يمكنك تسجيل الدخول حاليًا. إذا كنت تعتقد أن هذا خطأ، تواصل مع فريق الدعم.",
        },
        banned: {
          title: "لا يمكن استخدام هذا الحساب",
          body: "تم إغلاقه لمخالفة شروط حجز. إذا كنت تعتقد أن هذا خطأ، تواصل مع فريق الدعم.",
        },
      },
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
        code: {
          title: "أدخل الرمز المكوّن من 6 أرقام",
          subtitle: "أُرسل على واتساب إلى {{phone}}.",
          ownerHint: "تملك ملعبًا؟ أرسلنا لك رسالة على واتساب بدلًا من الرمز.",
          ownerLink: "إعادة التعيين عبر الدعم",
        },
        newPassword: {
          title: "اختر كلمة مرور جديدة",
          subtitle: "ستستخدمها لتسجيل الدخول. سيتم تسجيل الخروج من كل الأجهزة المسجلة الآن.",
          newPassword: "كلمة المرور الجديدة",
          submit: "إعادة تعيين كلمة المرور",
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
        haveCodeBody: "انضم بالرمز الذي أرسله لك المالك.",
      },
    },
  },
};

export default ar;
