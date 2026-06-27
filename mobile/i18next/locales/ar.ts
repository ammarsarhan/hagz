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
            }
        }
    }
}

export default ar;
export type Translations = typeof ar;
