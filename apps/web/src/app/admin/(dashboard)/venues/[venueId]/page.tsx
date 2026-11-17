"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@/admin/api";
import { AccessAction } from "@/admin/admins/panels";
import { Button } from "@/admin/button";
import { Skeleton, Tag } from "@/admin/data-table";
import { ConfirmDialog, Modal } from "@/admin/dialog";
import { send } from "@/admin/errors";
import { TextAreaField } from "@/admin/field";
import { ReasonDialog } from "@/admin/reason-dialog";
import { Section } from "@/admin/section";
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
import { useCurrentVenue } from "@/admin/venues/venue";

// A venue's Overview tab: where it is on its way to live, and the review's steps, laid out like the
// Account page (titled sections down half the page). Who and where first; then what its status
// needs: the owner's checklist while it's a draft (and why it was last sent back), Approve or Send
// back while it's in review, what going live needs while it's provisioning (with the tax number's
// check), and Pause or Resume once it's live. Every step asks first, and the venue's header and
// this tab catch up after it.

type Action = "approve" | "reject" | "tax" | "go-live" | "pause" | "resume";

export default function VenueOverviewPage() {
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
  const step = (path: "approve" | "go-live" | "pause" | "resume") => () =>
    send(api.POST(`/v1/admin/venues/{id}/${path}`, { params: { path: { id: venueId } } }));

  return (
    <div className="lg:w-1/2">
      <Section title="Venue" description="Who runs it and where it is.">
        <div>
          <DetailRow
            label="Owner"
            value={
              venue.owner ? (
                <Link
                  href={venueHref(venueId, "team")}
                  className="underline-offset-2 hover:underline"
                >
                  {venue.owner.name}
                </Link>
              ) : (
                <Muted>None</Muted>
              )
            }
          />
          <DetailRow label="Phone" value={venue.owner?.phone ?? <Muted>None</Muted>} />
          <DetailRow
            label="Area"
            value={
              venue.area ??
              (venue.requestedArea ? (
                <span>
                  {venue.requestedArea} <Tag>Requested</Tag>
                </span>
              ) : (
                <Muted>None</Muted>
              ))
            }
          />
          <DetailRow label="Grounds" value={venue.groundCount.toLocaleString("en")} />
          <DetailRow label="Created" value={dateTime(venue.createdAt)} />
        </div>
      </Section>

      {venue.status === "DRAFT" ? <Setup overview={data} /> : null}

      {venue.status === "SUBMITTED" ? (
        <Section
          title="Review"
          description="Approve it to start provisioning, or send it back to the owner with what to change."
        >
          <div>
            <DetailRow
              label="Sent for review"
              value={data.submittedAt ? dateTime(data.submittedAt) : <Muted>Unknown</Muted>}
            />
          </div>
          <Actions>
            <AccessAction
              title="Approve"
              description={
                venue.area === null && venue.requestedArea
                  ? `Waits for the area the owner asked for (${venue.requestedArea}): add it under Platform and set it first.`
                  : "Moves it to provisioning, where you complete its listing before it goes live. The owner is told."
              }
              action="Approve"
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
        </Section>
      ) : null}

      {venue.status === "PROVISIONING" ? (
        <Section
          title="Going live"
          description="What it needs before players can find and book it."
        >
          <div>
            {GO_LIVE_NEEDS.map((need) => (
              <DetailRow
                key={need}
                label={goLiveLabel[need]}
                value={data.goLive.includes(need) ? <Muted>Missing</Muted> : "Done"}
              />
            ))}
            <DetailRow
              label="Tax number"
              value={
                data.taxNumber.value === null ? (
                  <Muted>None</Muted>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{data.taxNumber.value}</span>
                    {data.taxNumber.check ? (
                      <Tag tone={data.taxNumber.check.valid ? "on" : "neutral"}>
                        {data.taxNumber.check.valid ? "Valid" : "Not valid"}
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
            {data.taxNumber.value === null ? null : (
              <AccessAction
                title="Check tax number"
                description="Record whether the number is real and theirs, with a note if it isn't."
                action="Check"
                onClick={() => setAction("tax")}
              />
            )}
            <AccessAction
              title="Go live"
              description={
                data.goLive.length > 0
                  ? `Not yet: missing ${data.goLive.map((gap) => goLiveLabel[gap].toLowerCase()).join(", ")}.`
                  : "Players can find and book it from now on. The owner is told."
              }
              action="Go live"
              disabled={data.goLive.length > 0}
              onClick={() => setAction("go-live")}
            />
          </Actions>
        </Section>
      ) : null}

      {venue.status === "LIVE" || venue.status === "MAINTENANCE" ? (
        <Section
          title="Bookings"
          description={
            venue.status === "LIVE"
              ? "It's live: players can find and book it."
              : "It's paused: players can't book it until it's resumed."
          }
        >
          {venue.status === "LIVE" ? (
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
      ) : null}

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
      {action === "pause" ? (
        <ConfirmDialog
          title={`Pause ${name}?`}
          description="No new bookings until it's resumed. Bookings already made stand."
          confirmLabel="Pause"
          request={step("pause")}
          onClose={close}
          onDone={changed}
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
          onDone={changed}
        />
      ) : null}
    </div>
  );
}

// The owner's checklist while it's a draft: each item done or not, required ones counted, and why the
// last review sent it back, if it did.
function Setup({ overview }: { overview: VenueOverview }) {
  const { items, required } = overview.setup;
  return (
    <Section
      title="Setup"
      description={`The owner's checklist: ${String(required.done)} of ${String(required.total)} required items done.`}
    >
      {overview.rejection ? (
        <div className="mb-4 rounded-card border border-border bg-[#fafafa] px-4 py-3">
          <p className="text-label font-medium text-ink">
            Sent back {dateTime(overview.rejection.at)}
          </p>
          <p className="mt-0.5 text-label text-ink-2">{overview.rejection.reason}</p>
        </div>
      ) : null}
      <div>
        {items.map((item) => (
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
    </Section>
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

// The action rows under a section's facts.
function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col gap-6">{children}</div>;
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
