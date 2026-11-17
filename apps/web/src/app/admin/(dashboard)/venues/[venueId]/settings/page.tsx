"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/admin/api";
import { AccessAction } from "@/admin/admins/panels";
import { ConfirmDialog } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { Section } from "@/admin/section";
import { VenueSectionPlaceholder } from "@/admin/venues/section-page";
import { isApplying } from "@/admin/venues/sections";
import { useCurrentVenue } from "@/admin/venues/venue";

// A venue's Settings tab: how Hagz runs it, as opposed to Details, which is what players see. For
// now, pausing and resuming its bookings once it's live; the commission override and the
// cancellation policy join it with the phases that build them. Every change asks first.
export default function VenueSettingsPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { venue, reload } = useCurrentVenue();
  const [action, setAction] = useState<"pause" | "resume">();
  const close = () => setAction(undefined);

  if (!venue) return null;
  if (isApplying(venue.status)) return <VenueSectionPlaceholder slug="settings" />;

  const name = venue.names.en ?? venue.names.ar ?? "this venue";
  const live = venue.status === "LIVE";
  const step = (path: "pause" | "resume") => () =>
    send(api.POST(`/v1/admin/venues/{id}/${path}`, { params: { path: { id: venueId } } }));

  return (
    <div className="lg:w-1/2">
      <Section
        title="Bookings"
        description={
          live
            ? "It's live: players can find and book it."
            : "It's paused: players can't book it until it's resumed."
        }
      >
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
            description="Bookable again. It needs an open ground."
            action="Resume"
            onClick={() => setAction("resume")}
          />
        )}
      </Section>

      {action === "pause" ? (
        <ConfirmDialog
          title={`Pause ${name}?`}
          description="No new bookings until it's resumed. Bookings already made stand."
          confirmLabel="Pause"
          request={step("pause")}
          onClose={close}
          onDone={reload}
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
          onDone={reload}
        />
      ) : null}
    </div>
  );
}
