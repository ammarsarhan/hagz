"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/admin/api";
import { AccessAction } from "@/admin/admins/panels";
import { Skeleton } from "@/admin/data-table";
import { ConfirmDialog } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { DetailsBlock } from "@/admin/venues/details-block";
import { useVenueSettings } from "@/admin/venues/settings";
import {
  BookingRulesSection,
  CancellationSection,
  CommissionSection,
  LoyaltySection,
  PaymentsSection,
} from "@/admin/venues/settings-sections";
import { useCurrentVenue } from "@/admin/venues/venue";

// A venue's Settings tab: how Hagz runs it, as opposed to Details, which is what players see. Blocks
// of settings changed in place (user, 2026-11-18): pausing and resuming once it's live, then Hagz's
// commission, and the settings its owner also changes in the staff app, which admins change for
// support. Each block saves on its own; every change is on the History as the admin's.
export default function VenueSettingsPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { venue, reload: reloadVenue } = useCurrentVenue();
  const { data, error, reload } = useVenueSettings(venueId);
  const [action, setAction] = useState<"pause" | "resume">();
  const close = () => setAction(undefined);

  if (!venue) return null;
  const name = venue.names.en ?? venue.names.ar ?? "this venue";
  const running = venue.status === "LIVE" || venue.status === "MAINTENANCE";
  const live = venue.status === "LIVE";
  const step = (path: "pause" | "resume") => () =>
    send(api.POST(`/v1/admin/venues/{id}/${path}`, { params: { path: { id: venueId } } }));
  const props = data ? { venueId, data, onSaved: reload } : undefined;

  return (
    // The first block sits right under the tabs, like the other tabs' content.
    <section className="lg:w-2/3 [&>*:first-child]:mt-0">
      {running ? (
        <DetailsBlock title="Bookings">
          <div className="py-4">
            {live ? (
              <AccessAction
                title="Pause"
                description="No new bookings until it's resumed. Bookings already made stand."
                action="Pause"
                onClick={() => setAction("pause")}
              />
            ) : (
              <AccessAction
                title="Resume"
                description="Paused: players can't book it. Resuming needs an open ground."
                action="Resume"
                onClick={() => setAction("resume")}
              />
            )}
          </div>
        </DetailsBlock>
      ) : null}

      {error && !data ? (
        <p className="text-body text-ink-2">{error}</p>
      ) : !props ? (
        <Skeleton className="h-72 w-full rounded-card" />
      ) : (
        <>
          {/* Keyed by what's saved, so a section starts again from it after a save. */}
          <CommissionSection key={JSON.stringify(props.data.commission)} {...props} />
          <BookingRulesSection
            key={`rules-${String(props.data.settings.autoConfirm)}-${String(props.data.settings.minimumNotice)}`}
            {...props}
          />
          <PaymentsSection
            key={`pay-${props.data.settings.paymentMode}-${String(props.data.settings.depositPercent)}`}
            {...props}
          />
          <CancellationSection
            key={`cancel-${String(props.data.settings.cancellationPolicy)}-${JSON.stringify(props.data.settings.cancellationTiers)}`}
            {...props}
          />
          <LoyaltySection
            key={`loyalty-${JSON.stringify(props.data.settings.loyalty)}`}
            {...props}
          />
        </>
      )}

      {action === "pause" ? (
        <ConfirmDialog
          title={`Pause ${name}?`}
          description="No new bookings until it's resumed. Bookings already made stand."
          confirmLabel="Pause"
          request={step("pause")}
          onClose={close}
          onDone={reloadVenue}
        />
      ) : null}
      {action === "resume" ? (
        <ConfirmDialog
          title={`Resume ${name}?`}
          description="Players can book it again."
          confirmLabel="Resume"
          danger={false}
          request={step("resume")}
          onClose={close}
          onDone={reloadVenue}
        />
      ) : null}
    </section>
  );
}
