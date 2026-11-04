import type { Metadata } from "next";
import { PolicyPage } from "@/admin/policy-page";

export const metadata: Metadata = { title: "Terms · Hagz Admin" };

// Preliminary: written for the admin web as it is now, to be replaced by the reviewed terms.
export default function AdminTerms() {
  return (
    <PolicyPage title="Terms of Use" updated="Preliminary · Last updated 4 November 2026">
      <p>
        These terms apply to everyone with access to Hagz Admin. By signing in you agree to them.
        They are preliminary and will be replaced by a reviewed version.
      </p>
      <h2>Who may use Hagz Admin</h2>
      <p>
        Only people invited by an existing admin, for their work at Hagz. Access is personal: never
        share your account, password or authenticator.
      </p>
      <h2>Keeping your account safe</h2>
      <ul>
        <li>Use a password you don’t use anywhere else.</li>
        <li>Keep your authenticator on a device only you can open.</li>
        <li>Sign out on shared computers.</li>
        <li>Tell another admin at once if you think someone else has your details.</li>
      </ul>
      <h2>Using customer and venue data</h2>
      <p>
        Hagz Admin shows information about customers, venue staff and venues. Use it only to run
        and support Hagz, never for anything personal, and never copy it out of Hagz without a work
        reason.
      </p>
      <h2>What is recorded</h2>
      <p>
        What you do in Hagz Admin is recorded with your name, so every change can be traced and
        reverted. See the Privacy Policy for what that record holds.
      </p>
      <h2>Ending access</h2>
      <p>
        Any admin may suspend another admin’s access, for example when they leave Hagz or if an
        account may be at risk. Hagz may end access at any time.
      </p>
    </PolicyPage>
  );
}
