// The code from an invitation link, kept until first run can open it. A link opened while signed out
// goes through onboarding and sign-in or sign-up first, so the code has to wait somewhere. It lives
// in memory only: the link is in WhatsApp, so if the app is closed in between, opening it again is
// the way back.
let pending: string | null = null;

export const pendingInvitation = {
  keep: (code: string) => {
    pending = code;
  },
  // Read once: after this the sheet owns it, and coming back to first run doesn't reopen it.
  take: () => {
    const code = pending;
    pending = null;
    return code;
  },
};
