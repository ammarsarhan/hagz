const ar = {
    translation: {
        components: {
            shared: {
                input: {
                    phone: {
                        label: "رقم الهاتف"
                    },
                    password: {
                        label: "كلمة المرور"
                    }
                }
            },
            feed: {
                card: {
                    pricing: "{{price}}/ساعة"
                }
            },
            authModal: {
                title: "ابحث واحجز ملاعب قريبة منك",
                description: "سجّل دخولك أو أنشئ حسابًا جديدًا للبدء!",
                cta: {
                    signIn: "سجّل الدخول برقم الهاتف",
                    separator: "او",
                    signUp: "أنشئ حساب"
                }
            }
        },
        auth: {
            signIn: {
                title: "سجّل الدخول الى حجز",
                cta: "سجّل الدخول",
                inputs: {
                    phone: {
                        placeholder: "e.g. 1023045006"
                    },
                    password: {
                        placeholder: "كلمة المرور",
                        forgot: "نسيت كلمة المرور؟",
                    }
                },
                alternate: {
                    label: "ليس لديك حساب؟",
                    link: "أنشئ حسابًا!"
                }
            },
            signUp: {
                introduction: {
                    title: "احجز ملعبك في ثواني!",
                    description: "دور على الملعب المناسب لماتشك الجاي واحجزه بسهولة، أو سجّل ملعبك وابدأ تستقبل الحجوزات.",
                    cta: {
                        primary: "ابدأ الآن",
                        secondary: "تخطَّ واستكشف"
                    },
                    disclaimer: "بالمتابعة، فإنك توافق على شروط استخدام المنصة."
                },
                role: {
                    title: "لنبدأ إعداد حسابك!",
                    description: "كيف ستستخدم حجز؟ يمكنك دائمًا تغيير هذا لاحقًا من إعدادات حسابك.",
                    roles: {
                        user: {
                            title: "لاعب",
                            description: "أريد اكتشاف الملاعب وحجزها بأفضل الأسعار."
                        },
                        owner: {
                            title: "مالك ملعب",
                            description: "أريد إدارة ملاعبي وتنظيم حجوزاتها."
                        }
                    },
                    cta: {
                        primary: "التالي"
                    }
                },
                name: {
                    title: "بماذا تحب أن نناديك؟",
                    description: "يُفضّل استخدام اسمك الأول واسم العائلة كما يظهران في بطاقة هويتك.",
                    inputs: {
                        firstName: {
                            label: "الاسم الأول",
                            placeholder: "مثال: محمد"
                        },
                        lastName: {
                            label: "اسم العائلة",
                            placeholder: "مثال: احمد"
                        },
                    },
                    cta: {
                        primary: "التالي"
                    }
                },
                phone: {
                    title: "ما رقم هاتفك؟",
                    description: "سنستخدم رقم هاتفك لإرسال تأكيدات الحجوزات والتذكيرات عبر واتساب.",
                    cta: {
                        primary: "التالي"
                    }
                },
                password: {
                    title: "أمّن حسابك",
                    description: "احرص على أن تتضمن كلمة المرور حرفًا صغيرًا، وحرفًا كبيرًا، ورقمًا، ورمزًا خاصًا واحدًا على الأقل.",
                    inputs: {
                        password: {
                            placeholder: "8 أحرف على الأقل"
                        },
                        confirmPassword: {
                            placeholder: "أعد إدخال كلمة المرور"
                        },
                    },
                    cta: {
                        primary: "إنشاء الحساب"
                    }
                }
            }
        },
        user: {
            layout: {
                home: "الرئيسية",
                search: "البحث",
                history: "الحجوزات",
                profile: "حسابي"
            }
        }
    }
}

export default ar;
export type Translations = typeof ar;
