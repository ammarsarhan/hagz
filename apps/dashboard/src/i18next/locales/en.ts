// English strings, grouped by where they're used: components, screens, and common words shared by
// several screens. Placeholders use i18next's {{name}}. Western digits only (decided 2026-10-30).
const en = {
  translation: {
    components: {
      tabs: {
        home: "Home",
        calendar: "Calendar",
        venue: "Venue",
        payments: "Payments",
        account: "Account",
      },
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
        venues: "Venues",
        join: {
          title: "Join or create a venue",
          body: "Accept an invitation, or set up another venue.",
          waiting_one: "{{count}} invitation waiting",
          waiting_other: "{{count}} invitations waiting",
        },
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
      join: {
        title: "Join or create a venue",
        invitedSubtitle_one: "You've been invited to join another venue.",
        invitedSubtitle_other: "You've been invited to join {{count}} more venues.",
        emptySubtitle: "Join a team with an invitation, or set up a venue of your own.",
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
        draftSubtitle: "Pick up where you left off.",
        draft: {
          heading: "Your venue",
          settingUp: "Setting up",
          inReview: "In review",
          continue: "Continue setting up",
          sendWhenDone: "Send for review once the {{count}} required items are done",
          updatedNow: "Last updated just now",
          updatedMinutes_one: "Last updated {{count}} minute ago",
          updatedMinutes_other: "Last updated {{count}} minutes ago",
          updatedHours_one: "Last updated {{count}} hour ago",
          updatedHours_other: "Last updated {{count}} hours ago",
          updatedDays_one: "Last updated {{count}} day ago",
          updatedDays_other: "Last updated {{count}} days ago",
        },
      },
      createVenue: {
        start: {
          title: "Add your venue",
          subtitle: "Three steps. Nothing is public until we've reviewed it together.",
          step: "Step {{number}}",
          action: "Get started",
          steps: {
            place: {
              title: "Name and place",
              body: "Your venue's name and where it is on the map. About a minute.",
            },
            setup: {
              title: "Set it up",
              body: "Grounds and prices, opening hours, photos and how players pay. Any order, saved as you go.",
            },
            review: {
              title: "Send for review",
              body: "We check the details with you, then your venue opens for bookings.",
            },
          },
        },
        name: {
          title: "What's your venue called?",
          subtitle:
            "Use the name players already know. Arabic or English is fine; we add the other language before you go live.",
          label: "Venue name",
        },
        place: {
          findTitle: "Where is {{name}}?",
          findBody: "Search for it, or move the map to it. Players use this for directions.",
          pinTitle: "Is the pin in the right spot?",
          pinBody: "Move the map until the pin sits on your entrance.",
          movePin: "Move the map to adjust the pin",
          pinnedHere: "This spot on the map",
          areaTitle: "Is it in {{area}}?",
          areaUnknownTitle: "Which area is it in?",
          areaBody: "Players browse venues by area. We picked this one from your pin.",
          create: "Yes, create venue",
          differentArea: "Choose a different area",
          chooseArea: "Choose an area",
          areaSearchPlaceholder: "Search areas",
          noAreas: "No area by that name.",
          searchTitle: "Find your venue",
          searchPlaceholder: "Search for your venue or street",
          useMyLocation: "Use my current location",
          cantFind: "Can't find it?",
          dropPin: "Drop a pin on the map",
          clear: "Clear search",
          noResults:
            "Nothing for \u201C{{query}}\u201D. Try a street or a landmark, or drop a pin.",
          searchFailed: "Couldn't search right now",
          searchUnavailable: "Search isn't available. Drop a pin on the map instead.",
          locationDenied: "Location is off for Hagz",
          locationFailed: "Couldn't find where you are",
          outsideMarketplaces: "Hagz isn't in that country yet",
        },
      },
      setup: {
        subtitle:
          "Finish setting up in any order. When the required items are done, send it for review.",
        untitled: "Your venue",
        progress: "{{done}} of {{total}} required done",
        nextUp: "Next up: {{item}}",
        allDone: "Everything required is done.",
        required: "Required",
        optional: "Optional",
        itemsLeft_one: "{{count}} required item left. Review usually takes a day.",
        itemsLeft_other: "{{count}} required items left. Review usually takes a day.",
        readyToSend: "Everything required is done. Review usually takes a day.",
        send: "Send for review",
        states: {
          todo: "To do",
          done: "Done",
          optional: "Optional",
          // GROUNDS is the only item that blocks another (opening hours, and the layout), so these
          // two name it. Revisit if the API ever blocks on something else.
          waiting: "Waiting on grounds",
          blockedBody: "Add a ground first",
        },
        items: {
          DETAILS: { title: "Details", body: "Add a description and a phone number" },
          LOCATION: { title: "Location", body: "Where players will find you" },
          PHOTOS: { title: "Photos", body: "Add at least 3 photos of your grounds" },
          GROUNDS: { title: "Grounds and prices", body: "Add your first ground and what it costs" },
          SCHEDULES: {
            title: "Opening hours",
            body: "Set the hours each ground takes bookings",
          },
          LAYOUT: {
            title: "Layout",
            body: "Arrange your grounds the way they sit on the ground",
          },
          SETTINGS: {
            title: "Payments and cancellations",
            body: "Choose how players pay and your refund rules",
          },
          AMENITIES: {
            title: "Amenities",
            body: "Floodlights, parking, changing rooms and more",
          },
          TAX_NUMBER: { title: "Tax number", body: "Only if you charge VAT" },
        },
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
        opening: {
          title: "Opening your invitation",
          body: "Checking it was sent to {{phone}}.",
        },
        elsewhere: {
          title: "Sent to a different number",
          body: "You're signed in with {{phone}}. Sign in with the number the invitation was sent to, or ask for one to this number.",
          gotIt: "Got it",
          switch: "Sign in with another number",
        },
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
