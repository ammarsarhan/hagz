import { APPS, schemeFor } from "@hagz/contracts";
import { appEnv } from "@/lib/env";

// Dashboard links (/manage/...) open the app directly when it's installed and the domain is verified.
// This page is what everyone else sees: a button that opens the app by its scheme, and what to do
// if they don't have it.
export default async function ManageFallback({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const appUrl = `${schemeFor("dashboard", appEnv)}://manage/${path.map(encodeURIComponent).join("/")}`;
  const isInvitation = path[0] === "invite";

  return (
    <main
      style={{ maxWidth: 480, margin: "64px auto", padding: "0 16px", fontFamily: "system-ui" }}
    >
      <h1>
        {isInvitation ? "You're invited to join a venue on Hagz" : `Open ${APPS.dashboard.name}`}
      </h1>
      <p>
        {isInvitation
          ? `Open the invitation in ${APPS.dashboard.name}, signed in with the phone number it was sent to.`
          : `This link opens in ${APPS.dashboard.name}.`}
      </p>
      <p>
        <a href={appUrl}>Open in {APPS.dashboard.name}</a>
      </p>
      <p>Don&apos;t have the app yet? Install {APPS.dashboard.name}, then open this link again.</p>
    </main>
  );
}
