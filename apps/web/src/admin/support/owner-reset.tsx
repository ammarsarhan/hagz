"use client";

import { useState } from "react";
import { api } from "@/admin/api";
import { AccessAction } from "@/admin/admins/panels";
import { send } from "@/admin/errors";
import { ReasonDialog } from "@/admin/reason-dialog";
import { dateTime } from "@/admin/venues/history";

// Letting a venue owner reset their password once support has checked who they are: owners can't
// by themselves, as a recycled number would take the venue with it. On the Support page's staff
// panel and on the owner's panel in a venue's Team tab, for an active account only (the panels
// decide). The API doesn't say whether a grant is open, so once allowed it says until when for as
// long as the panel stays open.

const DAY = 24 * 60 * 60 * 1000;

export function OwnerResetAction({ staffId, name }: { staffId: string; name: string }) {
  const [asking, setAsking] = useState(false);
  const [until, setUntil] = useState<Date>();

  return (
    <div>
      {until ? (
        <p role="status" className="text-label text-ink-2">
          Password reset allowed until {dateTime(until.toISOString())}. Tell them to use Forgot
          password in the staff app.
        </p>
      ) : (
        <AccessAction
          title="Allow a password reset"
          description="Once you've checked who they are: they can reset it once in the app, with a code to their phone, within 24 hours. They keep every venue and permission."
          action="Allow"
          onClick={() => setAsking(true)}
        />
      )}
      {asking ? (
        <ReasonDialog
          title={`Let ${name} reset their password?`}
          description="Tell them to use Forgot password in the staff app within 24 hours. A code goes to their phone; nobody at Hagz sees the new password."
          confirmLabel="Allow reset"
          danger={false}
          hint="Kept on their account's record. Say how you checked who they are."
          placeholder="They called from their number and confirmed …"
          request={(reason) =>
            send(
              api.POST("/v1/admin/staff/{staffId}/password-reset", {
                params: { path: { staffId } },
                body: { reason },
              }),
            )
          }
          onClose={() => setAsking(false)}
          onDone={() => setUntil(new Date(Date.now() + DAY))}
        />
      ) : null}
    </div>
  );
}
