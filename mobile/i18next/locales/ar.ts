const ar = {
  translation: {
    components: {
      shared: {
        authModal: {
          title: 'ابحث واحجز ملاعب قريبة منك',
          description: 'سجّل دخولك أو أنشئ حسابًا جديدًا للبدء!',
          cta: {
            signIn: 'سجّل الدخول برقم الهاتف',
            separator: 'او',
            signUp: 'أنشئ حساب',
          },
        },
        input: {
          phone: {
            label: 'رقم الهاتف',
          },
          password: {
            label: 'كلمة المرور',
          },
        },
      },
      user: {
        feed: {
          card: {
            pricing: '{{price}}/ساعة',
          },
        },
      },
      dashboard: {
        logo: {
          first: 'لـ',
          second: 'الملاك',
        },
      },
    },
    auth: {
      signIn: {
        title: 'سجّل الدخول الى حجز',
        inputs: {
          phone: {
            placeholder: 'e.g. 1023045006',
          },
          password: {
            placeholder: 'كلمة المرور',
            forgot: 'نسيت كلمة المرور؟',
          },
        },
        cta: 'سجّل الدخول',
        alternate: {
          label: 'ليس لديك حساب؟',
          link: 'أنشئ حسابًا!',
        },
      },
      signUp: {
        introduction: {
          title: 'احجز ملعبك في ثواني!',
          description:
            'دور على الملعب المناسب لماتشك الجاي واحجزه بسهولة، أو سجّل ملعبك وابدأ تستقبل الحجوزات.',
          cta: {
            primary: 'ابدأ الآن',
            secondary: 'تخطَّ واستكشف',
          },
          disclaimer: 'بالمتابعة، فإنك توافق على شروط استخدام المنصة.',
        },
        role: {
          title: 'لنبدأ إعداد حسابك!',
          description: 'كيف ستستخدم حجز؟ يمكنك دائمًا تغيير هذا لاحقًا من إعدادات حسابك.',
          roles: {
            user: {
              title: 'مستخدم',
              description: 'أريد اكتشاف الملاعب وحجزها بأقل تكلفة ممكنة.',
            },
            manager: {
              title: 'مدير',
              description: 'أريد إدارة الملاعب وإدارة حجوزات ملعبي.',
            },
            owner: {
              title: 'مالك',
              description: 'أريد إدراج ملعبي على المنصة وقبول الحجوزات.',
            },
          },
          cta: {
            primary: 'التالي',
          },
        },
        name: {
          title: 'بماذا تحب أن نناديك؟',
          description: 'يُفضّل استخدام اسمك الأول واسم العائلة كما يظهران في بطاقة هويتك.',
          inputs: {
            firstName: {
              label: 'الاسم الأول',
              placeholder: 'مثال: محمد',
            },
            lastName: {
              label: 'اسم العائلة',
              placeholder: 'مثال: احمد',
            },
          },
          cta: {
            primary: 'التالي',
          },
        },
        phone: {
          title: 'ما رقم هاتفك؟',
          description: 'سنستخدم رقم هاتفك لإرسال تأكيدات الحجوزات والتذكيرات عبر واتساب.',
          cta: {
            primary: 'التالي',
          },
        },
        password: {
          title: 'أمّن حسابك',
          description:
            'احرص على أن تتضمن كلمة المرور حرفًا صغيرًا، وحرفًا كبيرًا، ورقمًا، ورمزًا خاصًا واحدًا على الأقل.',
          inputs: {
            password: {
              placeholder: '8 أحرف على الأقل',
            },
            confirmPassword: {
              placeholder: 'أعد إدخال كلمة المرور',
            },
          },
          cta: {
            primary: 'إنشاء الحساب',
          },
        },
      },
    },
    user: {
      main: {
        layout: {
          home: 'الرئيسية',
          search: 'البحث',
          history: 'السجل',
          profile: 'الملف الشخصي',
        },
      },
    },
    dashboard: {
      onboarding: {
        owner: {
          index: {
            title: 'لنجهّز ملعب {{name}} ونطلقه!',
            description: 'سيستغرق ذلك حوالي 10 دقائق.',
            cta: 'ابدأ الآن',
          },
        },
      },
    },
  },
};

export default ar;
export type Translations = typeof ar;