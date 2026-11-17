"use client";

import type { AdminVenue, VenueStatus } from "@hagz/contracts";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { api } from "@/admin/api";
import { ago } from "@/admin/admins/model";
import { AccessAction } from "@/admin/admins/panels";
import { Button } from "@/admin/button";
import { Skeleton, Tag } from "@/admin/data-table";
import { ConfirmDialog, Modal } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { TextAreaField } from "@/admin/field";
import { JourneyStep, type JourneyState } from "@/admin/journey";
import { Reveal } from "@/admin/reveal";
import { DetailRow } from "@/admin/side-panel";
import { useSubmit } from "@/admin/submit";
import { dateTime } from "@/admin/venues/history";
import {
  GO_LIVE_NEEDS,
  goLiveLabel,
  setupLabel,
  useVenueOverview,
  type VenueOverview,
} from "@/admin/venues/overview";
import { venueHref } from "@/admin/venues/sections";
import { SendBackDialog } from "@/admin/venues/send-back-dialog";
import { TaxCheckDialog } from "@/admin/venues/tax-check-dialog";
import { useCurrentVenue } from "@/admin/venues/venue";

// A venue's Application tab, shown only until it's live (Figma A5, option 2, with option 4's facts):
// its way to live as one journey down the page, Created, Setup, Review, Provisioning and Live, beside
// the venue's facts. The step its status is at holds what to do now; done steps say how they went
// (the finished checklist opens on demand) and later ones what they'll ask. Every step asks first,
// and the venue's header and this tab catch up after it; going live moves the venue off this tab.

type Action = "approve" | "reject" | "tax" | "go-live";

// The step each applying status is at: 0 Created, 1 Setup, 2 Review, 3 Provisioning, 4 Live.
const currentStep: Partial<Record<VenueStatus, number>> = {
  DRAFT: 1,
  SUBMITTED: 2,
  PROVISIONING: 3,
};

export default function VenueApplicationPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { venue, reload: reloadVenue } = useCurrentVenue();
  const { data, error, reload } = useVenueOverview(venueId);
  const [action, setAction] = useState<Action>();
  const close = () => setAction(undefined);
  const changed = () => {
    reload();
    reloadVenue();
  };

  if (error && !data) return <p className="text-body text-ink-2">{error}</p>;
  if (!venue || !data) return <Loading />;

  const name = venue.names.en ?? venue.names.ar ?? "this venue";
  const step = (path: "approve" | "go-live") => () =>
    send(api.POST(`/v1/admin/venues/{id}/${path}`, { params: { path: { id: venueId } } }));

  const current = currentStep[venue.status] ?? 3;
  const state = (index: number): JourneyState =>
    index < current ? "done" : index === current ? "current" : "later";

  const { required, items } = data.setup;
  const skipped = items
    .filter((item) => !item.required && item.state !== "DONE")
    .map((item) => setupLabel[item.key]);
  const goLiveDone = GO_LIVE_NEEDS.length - data.goLive.length;
  const areaMissing = venue.area === null;

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-20">
      <ol className="min-w-0 lg:max-w-[43.75rem] lg:flex-1">
        <JourneyStep
          state="done"
          title="Created"
          meta={`${dateTime(venue.createdAt)}${venue.owner ? ` by ${venue.owner.name}` : ""}`}
        />

        <JourneyStep
          state={state(1)}
          title={venue.status === "DRAFT" ? "Setup" : "Setup finished"}
          meta={
            venue.status === "DRAFT"
              ? `${String(required.done)} of ${String(required.total)} required items done.`
              : `${String(required.total)} of ${String(required.total)} required items.${
                  skipped.length > 0 ? ` ${list(skipped)} not added (optional).` : ""
                }`
          }
        >
          {venue.status === "DRAFT" ? (
            <>
              {data.rejection ? (
                <div className="mb-4 rounded-card border border-border bg-[#fafafa] px-4 py-3">
                  <p className="text-label font-medium text-ink">
                    Sent back {dateTime(data.rejection.at)}
                  </p>
                  <p className="mt-0.5 text-label text-ink-2">{data.rejection.reason}</p>
                </div>
              ) : null}
              <Checklist overview={data} />
            </>
          ) : (
            <ChecklistToggle>
              <Checklist overview={data} />
            </ChecklistToggle>
          )}
        </JourneyStep>

        <JourneyStep
          state={state(2)}
          title={
            venue.status === "DRAFT"
              ? "Review"
              : venue.status === "SUBMITTED"
                ? "In review"
                : "Approved"
          }
          meta={
            venue.status === "SUBMITTED"
              ? data.submittedAt
                ? `Sent ${dateTime(data.submittedAt)} · ${ago(data.submittedAt)}`
                : "Waiting for your review."
              : venue.status === "DRAFT"
                ? "Approve it, or send it back to the owner with what to change."
                : "The owner was told."
          }
        >
          {venue.status === "SUBMITTED" ? (
            <div className="rounded-card border border-border p-5">
              <p className="text-body text-ink-2">
                {areaMissing && venue.requestedArea
                  ? `Approving waits for the area the owner asked for (${venue.requestedArea}): add it under Platform and set it first. You can still send it back.`
                  : "Approve it to start provisioning, or send it back to the owner with what to change."}
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="small" disabled={areaMissing} onClick={() => setAction("approve")}>
                  Approve
                </Button>
                <Button variant="secondary" size="small" onClick={() => setAction("reject")}>
                  Send back
                </Button>
              </div>
            </div>
          ) : null}
        </JourneyStep>

        <JourneyStep
          state={state(3)}
          title="Provisioning"
          meta={
            venue.status === "PROVISIONING"
              ? `${String(goLiveDone)} of ${String(GO_LIVE_NEEDS.length)} done. Complete its listing, then take it live.`
              : "You complete its listing: English and Arabic, an open ground, the tax number check."
          }
        >
          {venue.status === "PROVISIONING" ? (
            <>
              <ChecklistToggle>
                <GoLiveChecklist overview={data} />
              </ChecklistToggle>
              <GoLiveActions
                overview={data}
                onCheckTax={() => setAction("tax")}
                onGoLive={() => setAction("go-live")}
              />
            </>
          ) : null}
        </JourneyStep>

        <JourneyStep
          state="later"
          title="Live"
          meta="Players can find and book it. Pause and resume it from Settings."
          last
        />
      </ol>

      <Facts venueId={venueId} venue={venue} />

      {action === "approve" ? (
        <ConfirmDialog
          title={`Approve ${name}?`}
          description="It moves to provisioning. The owner is told, and can invite their staff."
          confirmLabel="Approve"
          danger={false}
          request={step("approve")}
          onClose={close}
          onDone={changed}
        />
      ) : null}
      {action === "reject" ? (
        <SendBackDialog
          venueId={venueId}
          name={name}
          sections={data.setup.items.map((item) => item.key)}
          onClose={close}
          onDone={changed}
        />
      ) : null}
      {action === "tax" ? (
        <TaxCheckDialog
          venueId={venueId}
          taxNumber={data.taxNumber.value ?? ""}
          onClose={close}
          onDone={changed}
        />
      ) : null}
      {action === "go-live" ? (
        <ConfirmDialog
          title={`Take ${name} live?`}
          description="Players can find and book it from now on. The owner is told."
          confirmLabel="Go live"
          danger={false}
          request={step("go-live")}
          onClose={close}
          onDone={changed}
        />
      ) : null}
    </div>
  );
}

// The owner's checklist, item by item: done, still to do, or waiting on another item.
function Checklist({ overview }: { overview: VenueOverview }) {
  return (
    <div>
      {overview.setup.items.map((item) => (
        <DetailRow
          key={item.key}
          label={item.required ? setupLabel[item.key] : `${setupLabel[item.key]} (optional)`}
          value={
            item.state === "BLOCKED" && item.blockedBy ? (
              <Muted>After {setupLabel[item.blockedBy].toLowerCase()}</Muted>
            ) : item.needsChanges ? (
              // Sent back asking to change it, and not edited since.
              "To modify"
            ) : item.state === "DONE" ? (
              "Done"
            ) : (
              <Muted>To do</Muted>
            )
          }
        />
      ))}
    </div>
  );
}

// A finished or reference checklist, folded away under "Show the checklist" (Setup finished, and
// what going live needs while provisioning).
function ChecklistToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className="cursor-pointer text-label font-medium text-ink underline underline-offset-2"
      >
        {open ? "Hide the checklist" : "Show the checklist"}
      </button>
      <Reveal id={id} open={open}>
        <div className="pt-2">{children}</div>
      </Reveal>
    </>
  );
}

// What going live needs while it's provisioning, and the tax number with its check.
function GoLiveChecklist({ overview }: { overview: VenueOverview }) {
  const { goLive, taxNumber } = overview;
  return (
    <div>
      {GO_LIVE_NEEDS.map((need) => (
        <DetailRow
          key={need}
          label={goLiveLabel[need]}
          value={goLive.includes(need) ? <Muted>Missing</Muted> : "Done"}
        />
      ))}
      <DetailRow
        label="Tax number"
        value={
          taxNumber.value === null ? (
            <Muted>None</Muted>
          ) : (
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{taxNumber.value}</span>
              {taxNumber.check ? (
                <Tag tone={taxNumber.check.valid ? "on" : "neutral"}>
                  {taxNumber.check.valid ? "Valid" : "Not valid"}
                </Tag>
              ) : (
                <Muted>Not checked</Muted>
              )}
            </span>
          )
        }
      />
    </div>
  );
}

// Checking the tax number and going live, always in view while it's provisioning.
function GoLiveActions({
  overview,
  onCheckTax,
  onGoLive,
}: {
  overview: VenueOverview;
  onCheckTax: () => void;
  onGoLive: () => void;
}) {
  const { goLive, taxNumber } = overview;
  return (
    <div className="mt-6 flex flex-col gap-6">
      {taxNumber.value === null ? null : (
        <AccessAction
          title="Check tax number"
          description="Record whether the number is real and theirs, with a note if it isn't."
          action="Check"
          onClick={onCheckTax}
        />
      )}
      <AccessAction
        title="Go live"
        description={
          goLive.length > 0
            ? `Not yet: missing ${goLive.map((gap) => goLiveLabel[gap].toLowerCase()).join(", ")}.`
            : "Players can find and book it from now on. The owner is told."
        }
        action="Go live"
        primary
        disabled={goLive.length > 0}
        onClick={onGoLive}
      />
    </div>
  );
}

// Who runs it and where it is, beside the journey: what a reviewer checks the application against.
function Facts({ venueId, venue }: { venueId: string; venue: AdminVenue }) {
  const rows: [string, ReactNode][] = [
    [
      "Owner",
      venue.owner ? (
        <Link
          href={venueHref(venueId, "team")}
          className="font-medium underline underline-offset-2"
        >
          {venue.owner.name}
        </Link>
      ) : (
        <Muted>None</Muted>
      ),
    ],
    ["Phone", venue.owner?.phone ?? <Muted>None</Muted>],
    [
      "Area",
      venue.area ??
        (venue.requestedArea ? (
          <span className="flex items-center gap-2">
            {venue.requestedArea} <Tag>Requested</Tag>
          </span>
        ) : (
          <Muted>None</Muted>
        )),
    ],
    ["Grounds", venue.groundCount.toLocaleString("en")],
    ["Created", dateTime(venue.createdAt)],
  ];
  return (
    <aside className="shrink-0 lg:w-[19.5rem]">
      <h2 className="text-subtitle font-semibold text-ink">Venue</h2>
      <dl className="mt-4 flex flex-col gap-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-caption text-ink-2">{label}</dt>
            <dd className="mt-0.5 text-body text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-3">{children}</span>;
}

function Loading() {
  return (
    <div aria-busy className="flex flex-col gap-3 lg:w-1/2">
      {["w-1/4", "w-3/4", "w-2/3", "w-1/2", "w-3/5"].map((width) => (
        <Skeleton key={width} className={`h-3.5 ${width}`} />
      ))}
    </div>
  );
}

// "Layout", "Layout and Amenities", "Layout, Photos and Amenities".
function list(names: string[]) {
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}
