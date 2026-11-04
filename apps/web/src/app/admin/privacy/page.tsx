import type { Metadata } from "next";
import { PolicyPage } from "@/admin/policy-page";

export const metadata: Metadata = { title: "Privacy Policy · Hagz Admin" };

// Preliminary: written for the admin web as it is now, to be replaced by the reviewed policy.
export default function AdminPrivacy() {
  return (
    <PolicyPage title="Privacy Policy" updated="Preliminary · Last updated 4 November 2026">
      <p>
        This policy covers Hagz Admin, the tool the Hagz team uses to run the platform. It explains
        what we keep about admins, why, and for how long. It is preliminary and will be replaced by
        a reviewed version.
      </p>
      <h2>What we keep</h2>
      <ul>
        <li>Your name and work email, from the invitation you accepted.</li>
        <li>Your password, stored only as a one-way hash. Nobody at Hagz can read it.</li>
        <li>Your authenticator secret, encrypted, used to check the codes from your app.</li>
        <li>
          Your sessions: when you signed in, from which device and network address, and when the
          session ended.
        </li>
        <li>
          A record of what you do in Hagz Admin, such as invitations sent and changes to venues or
          accounts.
        </li>
      </ul>
      <h2>Why we keep it</h2>
      <p>
        To sign you in safely, to stop anyone else using your account, and to keep an accurate
        history of changes made to Hagz. We do not use admin data for marketing and do not sell it.
      </p>
      <h2>Who can see it</h2>
      <p>
        Other admins can see your name, email and when you last signed in. The records of what
        admins do are kept for the Hagz team and anyone we are legally required to share them with.
        Our hosting and email providers process this data only to run the service.
      </p>
      <h2>How long we keep it</h2>
      <p>
        Your account stays while you are an admin. Sessions end after 12 hours. The record of what
        you did stays after your access ends, because it is part of the history of the platform.
      </p>
      <h2>Your choices</h2>
      <p>
        Ask another admin to correct your details, reset your password or authenticator, or end your
        access. For anything else, contact the Hagz team.
      </p>
    </PolicyPage>
  );
}
