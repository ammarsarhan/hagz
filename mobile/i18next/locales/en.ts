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
            },
            signUp: {
                introduction: {
                    title: "Book Pitches in Seconds!",
                    description: "Find and book the perfect pitch for your next match, or list your venue and start filling slots without the hassle.",
                    cta: {
                        primary: "Get Started",
                        secondary: "Skip & Explore"
                    },
                    disclaimer: "By continuing, you agree to the platform's Terms of Use."
                },
                role: {
                    title: "Let's get you up & running!",
                    description: "What will you use Hagz for? You can always change this later in your account settings.",
                    roles: {
                        user: {
                            title: "User",
                            description: "I want to discover pitches and book for as cheap as possible."
                        },
                        owner: {
                            title: "Owner",
                            description: "I want to manage pitches & manage my booking occupancy."
                        }
                    },
                    cta: {
                        primary: "Next"
                    }
                },
                name: {
                    title: "What should we call you?",
                    description: "Preferably, use your first and last name as their appear on your ID.",
                    inputs: {
                        firstName: {
                            label: "First Name",
                            placeholder: "e.g. Mohamed"
                        },
                        lastName: {
                            label: "Last Name",
                            placeholder: "e.g. Ahmed"
                        },
                    },
                    cta: {
                        primary: "Next"
                    }
                },
                phone: {
                    title: "What's your phone number?",
                    description: "We'll use your number to send booking confirmations and reminders via WhatsApp.",
                    cta: {
                        primary: "Next"
                    }
                },
                password: {
                    title: "Secure your account",
                    description: "Make sure your password has at least one lowercase and uppercase character, a number, and a special character.",
                    inputs: {
                        password: {
                            placeholder: "Min. 8 characters"
                        },
                        confirmPassword: {
                            placeholder: "Re-enter password"
                        },
                    },
                    cta: {
                        primary: "Create Account"
                    }
                }
            }
        }
    }
}

export default en;
export type Translations = typeof en;
