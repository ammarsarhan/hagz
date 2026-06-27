const en = {
    translation: {
        components: {
            shared: {
                input: {
                    phone: {
                        label: "Phone Number"
                    },
                    password: {
                        label: "Password"
                    }
                }
            },
            authModal: {
                title: "Find & Book Nearby Pitches",
                description: "Sign in to your account or create a new account to get started!",
                cta: {
                    signIn: "Sign In With Phone",
                    separator: "Or",
                    signUp: "Create Account"
                }
            }
        },
        auth: {
            signIn: {
                title: "Sign In to Hagz",
                inputs: {
                    phone: {
                        placeholder: "e.g. 1023045006"
                    },
                    password: {
                        placeholder: "Password",
                        forgot: "Forgot Password"
                    }
                },
                alternate: {
                    label: "Don't have an account?",
                    link: "Create one!"
                }
            }
        }
    }
}

export default en;
export type Translations = typeof en;
