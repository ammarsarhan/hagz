"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/admin/api";
import { AccessAction } from "@/admin/admins/panels";
import { Skeleton, SkeletonText } from "@/admin/data-table";
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
// of settings changed in place and saved as they change (user, 2026-11-18): pausing and resuming
// once it's live, then Hagz's commission, and the settings its owner also changes in the staff app,
// which admins change for support. Every change is on the History as the admin's.
export default function VenueSettingsPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { venue, reload: reloadVenue } = useCurrentVenue();
  const { data, error, saved } = useVenueSettings(venueId);
  const [action, setAction] = useState<"pause" | "resume">();
  const close = () => setAction(undefined);

  if (!venue) return null;
  const name = venue.names.en ?? venue.names.ar ?? "this venue";
  const running = venue.status === "LIVE" || venue.status === "MAINTENANCE";
  const live = venue.status === "LIVE";
  const step = (path: "pause" | "resume") => () =>
    send(api.POST(`/v1/admin/venues/{id}/${path}`, { params: { path: { id: venueId } } }));
  const props = data ? { venueId, data, onSaved: saved } : undefined;

  return (
    // The first block sits right under the tabs, like the other tabs' content.
    <section className="lg:w-2/3 [&>*:first-child]:mt-0">
      {running ? (
        <DetailsBlock title="Bookings">
          <div className="py-4">
            {live ? (
              <AccessAction
                page
                title="Pause"
                description="No new bookings until it's resumed. Bookings already made stand."
                action="Pause"
                onClick={() => setAction("pause")}
              />
            ) : (
              <AccessAction
                page
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
        <SettingsLoading />
      ) : (
        <>
          <CommissionSection {...props} />
          <BookingRulesSection {...props} />
          <PaymentsSection {...props} />
          <CancellationSection {...props} />
          <LoyaltySection {...props} />
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

// The sections under their titles, each with the toggles and fields it always shows (a deposit, a
// custom policy's rules or loyalty's numbers only come with the saved settings).
const LOADING: { title: string; fields: ("toggle" | "field" | "field-hint")[] }[] = [
  { title: "Commission", fields: ["toggle"] },
  { title: "Booking rules", fields: ["toggle", "field-hint"] },
  { title: "Payments", fields: ["field"] },
  { title: "Cancellation", fields: ["field-hint"] },
  { title: "Loyalty", fields: ["toggle"] },
];

function SettingsLoading() {
  // Blocks straight in the section, which takes the first one's top margin away.
  return (
    <>
      {LOADING.map(({ title, fields }) => (
        <DetailsBlock key={title} title={title}>
          <div aria-hidden className="flex flex-col gap-5 py-5">
            {fields.map((kind, index) =>
              kind === "toggle" ? (
                <div key={index} className="flex items-center justify-between gap-6">
                  <span className="flex flex-col">
                    <SkeletonText size="body" className="w-48" />
                    <SkeletonText size="caption" className="w-72" />
                  </span>
                  <Skeleton className="h-6 w-10 shrink-0 rounded-full" />
                </div>
              ) : (
                <div key={index} className="flex w-[calc(50%-0.375rem)] flex-col gap-2">
                  <SkeletonText size="label" className="w-28" />
                  <Skeleton className="h-12 w-full rounded-field" />
                  {kind === "field-hint" ? <SkeletonText size="caption" className="w-3/4" /> : null}
                </div>
              ),
            )}
          </div>
        </DetailsBlock>
      ))}
    </>
  );
}
