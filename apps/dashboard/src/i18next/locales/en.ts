// English strings, grouped by where they're used: components, screens, and common words shared by
// several screens. Placeholders use i18next's {{name}}. Western digits only (decided 2026-10-30).
const en = {
  translation: {
    components: {
      invitationCard: {
        invitedBy: "{{name}} invited you",
        grounds_one: "{{count}} ground",
        grounds_other: "{{count}} grounds",
        staff_one: "{{count}} staff",
        staff_other: "{{count}} staff",
        decline: "Decline",
        join: "Join",
        expiresIn_one: "Expires in {{count}} hour",
        expiresIn_other: "Expires in {{count}} hours",
        expiresSoon: "Expires within the hour",
      },
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
        contactSupport: "Contact support",
        backToSignIn: "Back to sign in",
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
      account: {
        open: "Your account",
        security: "Security",
        app: "App",
        twoFactor: {
          title: "Two-factor sign-in",
          off: "A WhatsApp code every time you sign in.",
          on: "On: a WhatsApp code at every sign-in.",
          turnOnTitle: "Turn on two-factor",
          turnOffTitle: "Turn off two-factor",
          subtitle: "Enter the code we sent to WhatsApp at {{phone}}.",
          turnOn: "Turn on",
          turnOff: "Turn off",
        },
        password: {
          title: "Password",
          body: "Reset it with a code to your WhatsApp.",
        },
        language: {
          title: "Language",
          body: "{{language}}, from your phone's settings.",
          en: "English",
          ar: "Arabic",
        },
        support: {
          body: "Message the Hagz team on WhatsApp.",
        },
        signOut: {
          title: "Sign out?",
          body: "You'll sign back in with your number and password. Your venues and invitations stay as they are.",
          cancel: "Cancel",
        },
        version: "Hagz for staff · {{version}}",
      },
      firstRun: {
        welcome: "Welcome, {{name}}",
        invitedSubtitle_one: "You've been invited to join a venue.",
        invitedSubtitle_other: "You've been invited to join {{count}} venues.",
        emptySubtitle: "Set up your venue to start taking bookings.",
        invitations: "Invitations · {{count}}",
        moreWays: "More ways to start",
        createVenueTitle: "Create your venue",
        createVenueTileBody: "Pitches, schedules and prices.",
        createVenueBody:
          "Add your pitches, schedules and prices. Our team reviews it before it goes live.",
        joiningTitle: "Joining someone's venue?",
        joiningBody: "Ask the owner to invite {{phone}}. The invitation will appear here.",
        haveCode: "Have a code?",
        haveCodeBody: "Join with the code an owner sent you.",
        profile: "Your profile",
        retry: "Try again",
      },
      invitation: {
        title: "Join {{venue}}",
        subtitle:
          "{{name}} invited you to the team. Here's what you'll be able to do; the owner can change it later.",
        areas: {
          bookings: "Bookings",
          customers: "Customers",
          schedule: "Schedule and prices",
          payments: "Payments",
          finance: "Finance",
          staff: "Team",
          venue: "Venue profile",
        },
        levels: {
          manage: "Manage",
          view: "View only",
          none: "No access",
        },
        join: "Join venue",
        decline: "Decline",
        ended: {
          title: "This invitation has ended",
          body: "It expired, was cancelled, or has already been used. Ask {{name}} to send you a new one.",
          bodyNoName:
            "It expired, was cancelled, or has already been used. Ask the owner to send you a new one.",
          gotIt: "Got it",
        },
        member: {
          title: "You're already on the team",
          body: "You're a member of {{venue}}, so there's nothing to accept.",
          open: "Open {{venue}}",
        },
      },
      haveCode: {
        wrong: "No invitation to your number has that code.",
        title: "Enter your invitation code",
        subtitle: "The 6-character code from the invitation the owner sent to {{phone}}.",
      },
      venueHome: {
        subtitle: "Your venue's home comes next.",
      },
      blocked: {
        suspended: {
          title: "Your account is suspended",
          body: "You can't sign in for now. If you think this is a mistake, contact our support team.",
        },
        banned: {
          title: "This account can't be used",
          body: "It was closed for breaking Hagz's terms. If you think this is a mistake, contact our support team.",
        },
      },
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
        haveCodeBody: "Join with the code an owner sent you.",
      },
    },
  },
};

export default en;
export type Translations = typeof en;

// Arabic has six plural forms where English has two: next to each counted string (one with an
// _other form) it may add _zero, _two, _few and _many.
type WithArabicPlurals<T> = {
  [K in keyof T]: T[K] extends object ? WithArabicPlurals<T[K]> : T[K];
} & {
  [
    K in keyof T as K extends `${infer Base}_other`
      ? `${Base}_zero` | `${Base}_two` | `${Base}_few` | `${Base}_many`
      : never
  ]?: string;
};
export type ArabicTranslations = WithArabicPlurals<Translations>;
