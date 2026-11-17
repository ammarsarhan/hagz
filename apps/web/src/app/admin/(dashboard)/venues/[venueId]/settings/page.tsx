"use client";

import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@/admin/api";
import { AccessAction } from "@/admin/admins/panels";
import { Skeleton } from "@/admin/data-table";
import { ConfirmDialog } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { DetailsBlock, DetailsRow } from "@/admin/venues/details-block";
import {
  loyaltyLabel,
  noticeLabel,
  paymentModeLabel,
  percent,
  policyLabel,
  tierLines,
  useVenueSettings,
} from "@/admin/venues/settings";
import {
  BookingRulesPanel,
  CancellationPanel,
  CommissionPanel,
  LoyaltyPanel,
  PaymentsPanel,
} from "@/admin/venues/settings-panels";
import { useCurrentVenue } from "@/admin/venues/venue";

// A venue's Settings tab: how Hagz runs it, as opposed to Details, which is what players see. Laid
// out like Details (a block per section, Edit at its end): pausing and resuming once it's live, then
// Hagz's commission, and the settings its owner also changes in the staff app, which admins change
// for support (user, 2026-11-18). Each section edits in its own side panel; every change is on the
// History as the admin's.

type Panel = "commission" | "rules" | "payments" | "cancellation" | "loyalty";

export default function VenueSettingsPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { venue, reload: reloadVenue } = useCurrentVenue();
  const { data, error, reload } = useVenueSettings(venueId);
  const [action, setAction] = useState<"pause" | "resume">();
  const [panel, setPanel] = useState<Panel>();
  const close = () => setAction(undefined);

  if (!venue) return null;
  const name = venue.names.en ?? venue.names.ar ?? "this venue";
  const running = venue.status === "LIVE" || venue.status === "MAINTENANCE";
  const live = venue.status === "LIVE";
  const step = (path: "pause" | "resume") => () =>
    send(api.POST(`/v1/admin/venues/{id}/${path}`, { params: { path: { id: venueId } } }));
  const edit = (to: Panel) =>
    data ? (
      <button
        type="button"
        onClick={() => setPanel(to)}
        className="shrink-0 cursor-pointer text-label font-semibold text-ink underline underline-offset-4 hover:opacity-70"
      >
        Edit
      </button>
    ) : null;
  const value = (text: ReactNode) => (data ? text : <Skeleton className="h-4 w-40" />);
  const settings = data?.settings;
  const commission = data?.commission;

  return (
    <section className="lg:w-2/3">
      <h2 className="text-[1.25rem] leading-[1.625rem] font-semibold text-ink">Settings</h2>
      <p className="mt-1 text-body text-ink-2">
        How Hagz runs the venue. The owner changes the booking settings in the staff app too.
      </p>

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
        <p className="mt-8 text-body text-ink-2">{error}</p>
      ) : (
        <>
          <DetailsBlock title="Commission" action={edit("commission")}>
            <DetailsRow label="Rate">
              {value(
                commission ? (
                  commission.override === null ? (
                    <span className="text-body text-ink">
                      {percent(commission.marketplaceRate)}
                      <span className="text-ink-2"> · the marketplace's</span>
                    </span>
                  ) : (
                    <span className="text-body text-ink">
                      {percent(commission.override)}
                      <span className="text-ink-2">
                        {" "}
                        · its own (the marketplace's is {percent(commission.marketplaceRate)})
                      </span>
                    </span>
                  )
                ) : null,
              )}
            </DetailsRow>
          </DetailsBlock>

          <DetailsBlock title="Booking rules" action={edit("rules")}>
            <DetailsRow label="Confirming">
              {value(
                <span className="text-body text-ink">
                  {settings?.autoConfirm ? "Automatic" : "Staff approve each booking"}
                </span>,
              )}
            </DetailsRow>
            <DetailsRow label="Booking closes">
              {value(
                <span className="text-body text-ink">
                  {settings ? noticeLabel[settings.minimumNotice] : null}
                </span>,
              )}
            </DetailsRow>
          </DetailsBlock>

          <DetailsBlock title="Payments" action={edit("payments")}>
            <DetailsRow label="Players pay">
              {value(
                <span className="text-body text-ink">
                  {settings ? paymentModeLabel[settings.paymentMode] : null}
                  {settings?.paymentMode === "DEPOSIT" && settings.depositPercent !== null ? (
                    <span className="text-ink-2"> · {settings.depositPercent}% online</span>
                  ) : null}
                </span>,
              )}
            </DetailsRow>
          </DetailsBlock>

          <DetailsBlock title="Cancellation" action={edit("cancellation")}>
            <DetailsRow label="Policy">
              {value(
                settings?.cancellationPolicy ? (
                  <>
                    <p className="text-body text-ink">{policyLabel[settings.cancellationPolicy]}</p>
                    {settings.cancellationTiers ? (
                      <ul className="mt-1 flex flex-col gap-0.5 text-label text-ink-2">
                        {tierLines(settings.cancellationTiers).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <span className="text-body text-ink-3">Not chosen yet</span>
                ),
              )}
            </DetailsRow>
          </DetailsBlock>

          <DetailsBlock title="Loyalty" action={edit("loyalty")}>
            <DetailsRow label="Rewards">
              {value(
                <span className={`text-body ${settings?.loyalty ? "text-ink" : "text-ink-3"}`}>
                  {settings ? loyaltyLabel(settings.loyalty) : null}
                </span>,
              )}
            </DetailsRow>
          </DetailsBlock>
        </>
      )}

      {data && panel === "commission" ? (
        <CommissionPanel
          venueId={venueId}
          data={data}
          onClose={() => setPanel(undefined)}
          onDone={reload}
        />
      ) : null}
      {data && panel === "rules" ? (
        <BookingRulesPanel
          venueId={venueId}
          data={data}
          onClose={() => setPanel(undefined)}
          onDone={reload}
        />
      ) : null}
      {data && panel === "payments" ? (
        <PaymentsPanel
          venueId={venueId}
          data={data}
          onClose={() => setPanel(undefined)}
          onDone={reload}
        />
      ) : null}
      {data && panel === "cancellation" ? (
        <CancellationPanel
          venueId={venueId}
          data={data}
          onClose={() => setPanel(undefined)}
          onDone={reload}
        />
      ) : null}
      {data && panel === "loyalty" ? (
        <LoyaltyPanel
          venueId={venueId}
          data={data}
          onClose={() => setPanel(undefined)}
          onDone={reload}
        />
      ) : null}

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
