"use client";

import type { AdminVenue, VenueStatus } from "@hagz/contracts";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@/admin/api";
import { ago } from "@/admin/admins/model";
import { AccessAction } from "@/admin/admins/panels";
import { Button } from "@/admin/button";
import { Skeleton, Tag } from "@/admin/data-table";
import { ConfirmDialog, Modal } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { TextAreaField } from "@/admin/field";
import { ReasonDialog } from "@/admin/reason-dialog";
import { DetailRow } from "@/admin/side-panel";
import { StageCard, type StageState } from "@/admin/stage-card";
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
import { useCurrentVenue } from "@/admin/venues/venue";

// A venue's Application tab, shown only until it's live (Figma A5, option 4): its way there as three
// stage cards, Setup, Review and Going live, each with its count, beside the venue's facts. The stage
// its status is at is open and the rest closed; any can be opened to look back or ahead. When the
// status moves on (after Approve, say) the cards follow it. Every step asks first, and the venue's
// header and this tab catch up after it; going live moves the venue off this tab.

type Action = "approve" | "reject" | "tax" | "go-live";

// The stage each applying status is at: 0 Setup, 1 Review, 2 Going live.
const currentStage: Partial<Record<VenueStatus, number>> = {
  DRAFT: 0,
  SUBMITTED: 1,
  PROVISIONING: 2,
};

export default function VenueApplicationPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const { venue, reload: reloadVenue } = useCurrentVenue();
  const { data, error, reload } = useVenueOverview(venueId);
  const [action, setAction] = useState<Action>();
  // The cards opened or closed by hand, for the status they were toggled in: a new status starts
  // again from its own stage open.
  const [opened, setOpened] = useState<{ status?: VenueStatus; stages: number[] }>({ stages: [] });
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

  const current = currentStage[venue.status] ?? 2;
  const isOpen = (stage: number) =>
    opened.status === venue.status ? opened.stages.includes(stage) : stage === current;
  const card = (stage: number) => ({
    number: stage + 1,
    state: (stage < current ? "done" : stage === current ? "current" : "later") as StageState,
    open: isOpen(stage),
    onToggle: () => {
      const now = [0, 1, 2].filter(isOpen);
      setOpened({
        status: venue.status,
        stages: now.includes(stage) ? now.filter((open) => open !== stage) : [...now, stage],
      });
    },
  });

  const { required } = data.setup;
  const goLiveDone = GO_LIVE_NEEDS.length - data.goLive.length;

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
      <div className="flex min-w-0 flex-col gap-3 lg:max-w-[47.5rem] lg:flex-1">
        <StageCard
          {...card(0)}
          title="Setup"
          description="The owner's checklist"
          summary={`${String(required.done)} of ${String(required.total)} done`}
        >
          <Checklist overview={data} />
        </StageCard>

        <StageCard
          {...card(1)}
          title="Review"
          description={
            venue.status === "SUBMITTED" && data.submittedAt
              ? `Sent ${dateTime(data.submittedAt)}`
              : "Approve it, or send it back with a reason"
          }
          summary={
            venue.status === "DRAFT"
              ? data.rejection
                ? "Sent back"
                : "Not sent yet"
              : venue.status === "SUBMITTED"
                ? data.submittedAt
                  ? `Sent ${ago(data.submittedAt)}`
                  : "Waiting"
                : "Approved"
          }
        >
          {venue.status === "SUBMITTED" ? (
            <Actions>
              <AccessAction
                title="Approve"
                description={
                  venue.area === null && venue.requestedArea
                    ? `Waits for the area the owner asked for (${venue.requestedArea}): add it under Platform and set it first.`
                    : "Moves it to provisioning, where you complete its listing before it goes live. The owner is told."
                }
                action="Approve"
                primary
                disabled={venue.area === null}
                onClick={() => setAction("approve")}
              />
              <AccessAction
                title="Send back"
                description="Back to a draft, with a reason the owner sees on their checklist."
                action="Send back"
                onClick={() => setAction("reject")}
              />
            </Actions>
          ) : venue.status === "DRAFT" && data.rejection ? (
            <div>
              <p className="text-label font-medium text-ink">
                Sent back {dateTime(data.rejection.at)}
              </p>
              <p className="mt-0.5 text-label text-ink-2">{data.rejection.reason}</p>
            </div>
          ) : (
            <p className="text-label text-ink-2">
              {venue.status === "DRAFT"
                ? "The owner sends it for review once the required items are done."
                : "Approved: it's being provisioned. The owner was told."}
            </p>
          )}
        </StageCard>

        <StageCard
          {...card(2)}
          title="Going live"
          description="English and Arabic listing, an open ground, the tax number"
          summary={
            venue.status === "PROVISIONING"
              ? `${String(goLiveDone)} of ${String(GO_LIVE_NEEDS.length)} done`
              : "After review"
          }
        >
          <GoingLive
            overview={data}
            provisioning={venue.status === "PROVISIONING"}
            onCheckTax={() => setAction("tax")}
            onGoLive={() => setAction("go-live")}
          />
        </StageCard>
      </div>

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
        <ReasonDialog
          title={`Send ${name} back?`}
          description="It goes back to being a draft. The owner sees your reason on their checklist."
          confirmLabel="Send back"
          hint="The owner reads this. Say what to change."
          placeholder="Add photos of the pitches themselves, not only the entrance."
          request={(reason) =>
            send(
              api.POST("/v1/admin/venues/{id}/reject", {
                params: { path: { id: venueId } },
                body: { reason },
              }),
            )
          }
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
            item.state === "DONE" ? (
              "Done"
            ) : item.state === "BLOCKED" && item.blockedBy ? (
              <Muted>After {setupLabel[item.blockedBy].toLowerCase()}</Muted>
            ) : (
              <Muted>To do</Muted>
            )
          }
        />
      ))}
    </div>
  );
}

// What going live needs, with the tax number's check. Before it's approved, only what will be
// asked, greyed, with nothing to press yet.
function GoingLive({
  overview,
  provisioning,
  onCheckTax,
  onGoLive,
}: {
  overview: VenueOverview;
  provisioning: boolean;
  onCheckTax: () => void;
  onGoLive: () => void;
}) {
  const { goLive, taxNumber } = overview;
  if (!provisioning) {
    return (
      <div>
        {GO_LIVE_NEEDS.map((need) => (
          <DetailRow key={need} label={goLiveLabel[need]} value={<Muted>After review</Muted>} />
        ))}
        <DetailRow label="Tax number check" value={<Muted>After review</Muted>} />
      </div>
    );
  }
  return (
    <>
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
      <Actions>
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
      </Actions>
    </>
  );
}

// Who runs it and where it is, beside the stages: what a reviewer checks the application against.
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

// Recording whether the tax number checks out: Valid, or Not valid with a note saying why.
function TaxCheckDialog({
  venueId,
  taxNumber,
  onClose,
  onDone,
}: {
  venueId: string;
  taxNumber: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const { busy, run } = useSubmit(onDone, onClose);
  const check = (valid: boolean) =>
    void run(() =>
      send(
        api.POST("/v1/admin/venues/{id}/tax-number-check", {
          params: { path: { id: venueId } },
          body: { valid, note: note.trim() || null },
        }),
      ),
    );
  return (
    <Modal
      onClose={onClose}
      title={`Check ${taxNumber}`}
      description="Record whether the number is real and belongs to the venue's business."
      footer={
        <>
          <Button variant="secondary" size="small" disabled={busy} onClick={() => check(false)}>
            Not valid
          </Button>
          <Button size="small" loading={busy} onClick={() => check(true)}>
            Valid
          </Button>
        </>
      }
    >
      <TextAreaField
        label="Note"
        hint="Optional. Kept with the check on the venue's History."
        value={note}
        maxLength={300}
        placeholder="Not found in the tax authority's register."
        onChange={(event) => setNote(event.target.value)}
      />
    </Modal>
  );
}

// The action rows under a card's facts, or on their own at the top of one.
function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col gap-6 first:mt-0">{children}</div>;
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
