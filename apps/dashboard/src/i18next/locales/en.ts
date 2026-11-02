// English strings, grouped by where they're used: components, screens, and common words shared by
// several screens. Placeholders use i18next's {{name}}. Western digits only (decided 2026-10-30).
const en = {
  translation: {
    components: {
      shared: {
        nav: {
          back: "Back",
          close: "Close",
        },
        passwordField: {
          show: "Show password",
          hide: "Hide password",
        },
        resendCode: {
          countdown: "Resend code in {{time}}",
          resend: "Resend code",
        },
      },
    },
    common: {
      actions: {
        continue: "Continue",
        createAccount: "Create account",
        signIn: "Sign in",
        signOut: "Sign out",
        sendCode: "Send code",
        verify: "Verify",
        change: "Change",
        forgotPassword: "Forgot password?",
      },
      comingNext: "This screen comes next.",
      fields: {
        mobileNumber: "Mobile number",
        fullName: "Full name",
        fullNamePlaceholder: "Your name",
        password: "Password",
      },
    },
    screens: {
      onboarding: {
        schedules: {
          title: "Scattered schedules, sorted.",
          body: "Every pitch and every booking on one calendar, from walk-ins to online bookings.",
        },
        money: {
          title: "Messy money, managed.",
          body: "Online payments, deposits and cash, tracked in one place and paid out to you.",
        },
        pitches: {
          title: "Empty pitches, packed.",
          body: "Players across your city find your venue, book open slots and come back as regulars.",
        },
      },
      signUp: {
        phone: {
          title: "What's your mobile number?",
          subtitle: "We'll send a code on WhatsApp to confirm it's yours.",
          terms: "By continuing you agree to Hagz's Terms and Privacy Policy.",
          invalid: "Enter a valid mobile number.",
        },
        code: {
          title: "Enter the 6-digit code",
          sentTo: "Sent on WhatsApp to {{phone}}.",
        },
        details: {
          title: "Set up your account",
          subtitle: "This is how your staff and customers will see you.",
          passwordRule: "At least 8 characters",
        },
        registered: {
          title: "You already have an account",
          body: "{{phone}} is already on Hagz. Sign in instead, or reset your password if you've forgotten it.",
        },
      },
      forgotPassword: {
        phone: {
          title: "Reset your password",
          subtitle: "Enter your mobile number and we'll send a code on WhatsApp.",
        },
        warning: {
          title: "Resetting makes you view-only",
          subtitle: "This keeps each venue safe if someone else ends up with your number.",
          canView: "You can still view",
          canViewBody: "Everything you had access to before.",
          cantChange: "You can't make changes",
          cantChangeBody: "Until an owner restores your access.",
          ownersTold: "Your venue's owners are told",
          ownersToldBody: "They'll see that you reset your password and can restore your access.",
          cancel: "Cancel",
        },
        code: {
          title: "Enter the 6-digit code",
          subtitle: "Sent on WhatsApp to {{phone}}.",
          ownerHint: "Own a venue? We've sent you a WhatsApp message instead of a code.",
          ownerLink: "Reset with support",
        },
        newPassword: {
          title: "Choose a new password",
          subtitle: "You'll use it to sign in. Every device signed in now will be signed out.",
          newPassword: "New password",
          submit: "Reset password",
        },
        support: {
          title: "Reset with support",
          subtitle:
            "Owners can't reset their password with a code. Our team confirms it's you first, then helps you back in.",
          whyTitle: "Why not a code?",
          whyBody:
            "Owners control payouts and who's on the team. A code alone isn't enough proof, especially if a number has been passed to someone new.",
          whatTitle: "What to do",
          whatBody: "Reply to the WhatsApp message we just sent you and we'll take it from there.",
          openWhatsApp: "Open WhatsApp",
          backToSignIn: "Back to sign in",
        },
      },
      signIn: {
        title: "Welcome back",
        subtitle: "Sign in with your mobile number and password.",
        twoFactor: {
          title: "Two-factor code",
          subtitle: "We sent a code on WhatsApp to {{phone}}.",
        },
      },
      home: {
        title: "You're signed in",
      },
      components: {
        title: "Components",
        subtitle: "Shared pieces of the staff app, live.",
        phoneTaken: "This number is already on Hagz.",
        passwordTooShort: "Use at least 8 characters.",
        codeWrong: "That code isn't right.",
        tooManyTries: "Too many attempts. Please wait a moment and try again.",
        couldntSendCode: "Couldn't send the code",
        showHud: "Show an error HUD",
        openSheet: "Open a sheet",
        invitationCodeTitle: "Enter your invitation code",
        invitationCodeSubtitle: "The 6-character code from the invitation the owner sent you.",
        createVenue: "Create your venue",
        haveCode: "Have a code?",
      },
    },
  },
};

export default en;
export type Translations = typeof en;
