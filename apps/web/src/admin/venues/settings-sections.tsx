"use client";

import {
  CANCELLATION_PRESETS,
  DEPOSIT_PERCENT,
  MAXIMUM_CANCELLATION_TIERS,
  NOTICE_CHOICES,
  type AdminVenueSettings,
  type CancellationPolicy,
  type MinimumNotice,
  type PaymentMode,
  type UpdateVenueSettings,
} from "@hagz/contracts";
import { IconTrash } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { send } from "@/admin/errors";
import { PillInput, PillSelect } from "@/admin/pill-select";
import { basisPoints, Toggle } from "@/admin/platform/forms";
import { useSubmit } from "@/admin/submit";
import { DetailsBlock } from "./details-block";
import { noticeLabel, paymentModeLabel, percent, policyLabel, tierLines } from "./settings";

// A venue's settings, changed in place on its admin Settings tab (user, 2026-11-18): each section a
// block of rows with its control on the right (a switch, a pill select, a pill number), and Save at
// the block's end, grey until something in it differs and is valid, with Discard beside it. Saving
// sends only that section's fields, through the same checks as the owner's, onto the History.

interface SectionProps {
  venueId: string;
  data: AdminVenueSettings;
  onSaved: () => void;
}

// A block with Discard and Save at its heading's end.
function SettingsBlock({
  title,
  changed,
  ready,
  request,
  onDiscard,
  onSaved,
  children,
}: {
  title: string;
  changed: boolean;
  ready: boolean;
  request: () => Promise<{ ok: boolean; error?: unknown }>;
  onDiscard: () => void;
  onSaved: () => void;
  children: ReactNode;
}) {
  // Errors go to the HUD; what was typed stays.
  const { busy, run } = useSubmit(onSaved, () => undefined);
  return (
    <DetailsBlock
      title={title}
      action={
        <span className="flex items-center gap-2">
          {changed && !busy ? (
            <Button variant="ghost" size="small" onClick={onDiscard}>
              Discard
            </Button>
          ) : null}
          <Button
            size="small"
            loading={busy}
            disabled={!changed || !ready}
            onClick={() => void run(request)}
          >
            Save
          </Button>
        </span>
      }
    >
      {children}
    </DetailsBlock>
  );
}

// A setting: its name and a line on what it does on the left, its control on the right.
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-12 border-b border-border py-4">
      <span className="flex min-w-0 flex-col">
        <span className="text-label text-ink">{label}</span>
        {hint ? <span className="text-caption text-ink-2">{hint}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </div>
  );
}

// A switch on its own row, with the row's hairline.
function ToggleRow(props: Parameters<typeof Toggle>[0]) {
  return (
    <div className="border-b border-border py-4">
      <Toggle {...props} />
    </div>
  );
}

const saveSettings = (venueId: string, body: UpdateVenueSettings) =>
  send(api.PATCH("/v1/admin/venues/{id}/settings", { params: { path: { id: venueId } }, body }));

// A whole number in a range, or null when the text isn't one.
const wholeIn = (text: string, min: number, max: number) => {
  const value = Number(text.trim());
  return text.trim() !== "" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
};

// --- Commission ---

export function CommissionSection({ venueId, data, onSaved }: SectionProps) {
  const { override, marketplaceRate } = data.commission;
  const initial = { own: override !== null, rate: override === null ? "" : String(override / 100) };
  const [form, setForm] = useState(initial);
  const parsed = basisPoints(form.rate);
  const next = form.own ? parsed : null;
  return (
    <SettingsBlock
      title="Commission"
      changed={form.own !== initial.own || form.rate !== initial.rate}
      ready={(!form.own || parsed !== null) && next !== override}
      request={() =>
        send(
          api.PUT("/v1/admin/venues/{id}/commission", {
            params: { path: { id: venueId } },
            body: { rate: next },
          }),
        )
      }
      onDiscard={() => setForm(initial)}
      onSaved={onSaved}
    >
      <ToggleRow
        label="Its own rate"
        hint={`Off, it takes the marketplace's ${percent(marketplaceRate)} of each booking.`}
        checked={form.own}
        onChange={(own) => setForm({ ...form, own })}
      />
      {form.own ? (
        <SettingRow label="Rate" hint="Hagz's share of each booking at this venue.">
          <PillInput
            label="Commission rate"
            unit="%"
            value={form.rate}
            placeholder={String(marketplaceRate / 100)}
            invalid={form.rate.trim() !== "" && parsed === null}
            onChange={(event) => setForm({ ...form, rate: event.target.value })}
          />
        </SettingRow>
      ) : null}
    </SettingsBlock>
  );
}

// --- Booking rules ---

export function BookingRulesSection({ venueId, data, onSaved }: SectionProps) {
  const initial = {
    autoConfirm: data.settings.autoConfirm,
    minimumNotice: data.settings.minimumNotice,
  };
  const [form, setForm] = useState(initial);
  const changed =
    form.autoConfirm !== initial.autoConfirm || form.minimumNotice !== initial.minimumNotice;
  return (
    <SettingsBlock
      title="Booking rules"
      changed={changed}
      ready
      request={() => saveSettings(venueId, form)}
      onDiscard={() => setForm(initial)}
      onSaved={onSaved}
    >
      <ToggleRow
        label="Confirm bookings automatically"
        hint="Off, the venue's staff approve each booking."
        checked={form.autoConfirm}
        onChange={(autoConfirm) => setForm({ ...form, autoConfirm })}
      />
      <SettingRow label="Booking closes" hint="How long before kick-off players can still book.">
        <PillSelect
          label="Booking closes"
          value={String(form.minimumNotice)}
          options={NOTICE_CHOICES.map((minutes) => ({
            value: String(minutes),
            label: noticeLabel[minutes],
          }))}
          onChange={(event) =>
            setForm({ ...form, minimumNotice: Number(event.target.value) as MinimumNotice })
          }
        />
      </SettingRow>
    </SettingsBlock>
  );
}

// --- Payments ---

export function PaymentsSection({ venueId, data, onSaved }: SectionProps) {
  const { settings } = data;
  const initial = {
    mode: settings.paymentMode,
    deposit: settings.depositPercent === null ? "" : String(settings.depositPercent),
  };
  const [form, setForm] = useState(initial);
  const depositValue = wholeIn(form.deposit, DEPOSIT_PERCENT.min, DEPOSIT_PERCENT.max);
  const nextDeposit = form.mode === "DEPOSIT" ? depositValue : null;
  return (
    <SettingsBlock
      title="Payments"
      changed={form.mode !== initial.mode || form.deposit !== initial.deposit}
      ready={
        (form.mode !== "DEPOSIT" || depositValue !== null) &&
        (form.mode !== settings.paymentMode || nextDeposit !== settings.depositPercent)
      }
      request={() => saveSettings(venueId, { paymentMode: form.mode, depositPercent: nextDeposit })}
      onDiscard={() => setForm(initial)}
      onSaved={onSaved}
    >
      <SettingRow label="Players pay" hint="How players pay for their bookings.">
        <PillSelect
          label="Players pay"
          value={form.mode}
          options={(Object.keys(paymentModeLabel) as PaymentMode[]).map((value) => ({
            value,
            label: paymentModeLabel[value],
          }))}
          onChange={(event) => setForm({ ...form, mode: event.target.value as PaymentMode })}
        />
      </SettingRow>
      {form.mode === "DEPOSIT" ? (
        <SettingRow
          label="Deposit"
          hint={`The share paid online, ${String(DEPOSIT_PERCENT.min)}% to ${String(DEPOSIT_PERCENT.max)}%.`}
        >
          <PillInput
            label="Deposit"
            unit="%"
            inputMode="numeric"
            value={form.deposit}
            invalid={form.deposit.trim() !== "" && depositValue === null}
            onChange={(event) => setForm({ ...form, deposit: event.target.value })}
          />
        </SettingRow>
      ) : null}
    </SettingsBlock>
  );
}

// --- Cancellation ---

interface TierText {
  hours: string;
  refundPercent: string;
}

export function CancellationSection({ venueId, data, onSaved }: SectionProps) {
  const { settings } = data;
  const initial = {
    policy: (settings.cancellationPolicy ?? "") as CancellationPolicy | "",
    tiers: (settings.cancellationPolicy === "CUSTOM" && settings.cancellationTiers
      ? settings.cancellationTiers
      : [{ hours: 24, refundPercent: 100 }]
    ).map((tier) => ({ hours: String(tier.hours), refundPercent: String(tier.refundPercent) })),
  };
  const [form, setForm] = useState(initial);
  const { policy, tiers } = form;

  const parsed = tiers.map((tier) => ({
    hours: wholeIn(tier.hours, 1, 336),
    refundPercent: wholeIn(tier.refundPercent, 0, 100),
  }));
  const complete = parsed.every((tier) => tier.hours !== null && tier.refundPercent !== null);
  // The API's rule: less notice each time, and never a bigger refund.
  const ordered = parsed.every((tier, i) => {
    const before = parsed[i - 1];
    return (
      !before ||
      ((tier.hours ?? 0) < (before.hours ?? 0) &&
        (tier.refundPercent ?? 0) <= (before.refundPercent ?? 0))
    );
  });
  const customTiers = parsed as { hours: number; refundPercent: number }[];
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  const setTier = (index: number, field: keyof TierText, value: string) =>
    setForm({
      ...form,
      tiers: tiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)),
    });

  return (
    <SettingsBlock
      title="Cancellation"
      changed={changed}
      ready={policy !== "" && (policy !== "CUSTOM" || (complete && ordered))}
      request={() =>
        policy === ""
          ? Promise.resolve({ ok: false })
          : saveSettings(venueId, {
              cancellationPolicy: policy,
              cancellationTiers: policy === "CUSTOM" ? customTiers : null,
            })
      }
      onDiscard={() => setForm(initial)}
      onSaved={onSaved}
    >
      <SettingRow
        label="Policy"
        hint="What players get back when they cancel. A venue cancelling refunds in full."
      >
        <PillSelect
          label="Cancellation policy"
          value={policy}
          options={[
            ...(policy === "" ? [{ value: "", label: "Choose a policy" }] : []),
            ...(Object.keys(policyLabel) as CancellationPolicy[]).map((value) => ({
              value,
              label: policyLabel[value],
            })),
          ]}
          onChange={(event) =>
            setForm({ ...form, policy: event.target.value as CancellationPolicy })
          }
        />
      </SettingRow>

      {policy !== "" && policy !== "CUSTOM" ? (
        <ul className="flex flex-col gap-1 border-b border-border py-4 text-label text-ink-2">
          {tierLines([...CANCELLATION_PRESETS[policy]]).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {policy === "CUSTOM" ? (
        <div className="border-b border-border py-4">
          <p className="text-caption text-ink-2">
            From the most notice to the least. Refunds never go up as notice drops.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {tiers.map((tier, index) => (
              <li key={index} className="flex items-center gap-2 text-label text-ink-2">
                <PillInput
                  label={`Rule ${String(index + 1)} refund`}
                  unit="%"
                  inputMode="numeric"
                  width="2.5rem"
                  value={tier.refundPercent}
                  invalid={
                    tier.refundPercent.trim() !== "" && parsed[index]?.refundPercent === null
                  }
                  onChange={(event) => setTier(index, "refundPercent", event.target.value)}
                />
                <span>back up to</span>
                <PillInput
                  label={`Rule ${String(index + 1)} hours before`}
                  unit="hours"
                  inputMode="numeric"
                  width="2.5rem"
                  value={tier.hours}
                  invalid={tier.hours.trim() !== "" && parsed[index]?.hours === null}
                  onChange={(event) => setTier(index, "hours", event.target.value)}
                />
                <span>before kick-off</span>
                <button
                  type="button"
                  aria-label={`Remove rule ${String(index + 1)}`}
                  disabled={tiers.length === 1}
                  onClick={() => setForm({ ...form, tiers: tiers.filter((_, i) => i !== index) })}
                  className="ml-auto flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-chip hover:text-ink disabled:cursor-default disabled:opacity-30"
                >
                  <IconTrash size={16} className="size-4" stroke={1.75} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-4">
            {tiers.length < MAXIMUM_CANCELLATION_TIERS ? (
              <Button
                variant="secondary"
                size="small"
                onClick={() =>
                  setForm({ ...form, tiers: [...tiers, { hours: "", refundPercent: "" }] })
                }
              >
                Add a rule
              </Button>
            ) : null}
            {complete && !ordered ? (
              <p className="text-caption font-medium text-red">
                Each rule needs less notice than the one before, and no bigger refund.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </SettingsBlock>
  );
}

// --- Loyalty ---

const STAMPS = { min: 2, max: 20 } as const;
const WINDOW_DAYS = { min: 1, max: 365 } as const;

export function LoyaltySection({ venueId, data, onSaved }: SectionProps) {
  const { loyalty } = data.settings;
  const initial = {
    on: loyalty !== null,
    stamps: String(loyalty?.stamps ?? 10),
    windowDays: String(loyalty?.windowDays ?? 90),
  };
  const [form, setForm] = useState(initial);
  const stampsValue = wholeIn(form.stamps, STAMPS.min, STAMPS.max);
  const windowValue = wholeIn(form.windowDays, WINDOW_DAYS.min, WINDOW_DAYS.max);
  const next =
    form.on && stampsValue !== null && windowValue !== null
      ? { stamps: stampsValue, windowDays: windowValue }
      : null;
  return (
    <SettingsBlock
      title="Loyalty"
      changed={JSON.stringify(form) !== JSON.stringify(initial)}
      ready={(!form.on || next !== null) && JSON.stringify(next) !== JSON.stringify(loyalty)}
      request={() => saveSettings(venueId, { loyalty: next })}
      onDiscard={() => setForm(initial)}
      onSaved={onSaved}
    >
      <ToggleRow
        label="Loyalty rewards"
        hint="Players collect a stamp per booking and get one free."
        checked={form.on}
        onChange={(on) => setForm({ ...form, on })}
      />
      {form.on ? (
        <>
          <SettingRow
            label="Bookings per free one"
            hint={`${String(STAMPS.min)} to ${String(STAMPS.max)}.`}
          >
            <PillInput
              label="Bookings per free one"
              inputMode="numeric"
              width="2.5rem"
              value={form.stamps}
              invalid={form.stamps.trim() !== "" && stampsValue === null}
              onChange={(event) => setForm({ ...form, stamps: event.target.value })}
            />
          </SettingRow>
          <SettingRow
            label="Stamps last"
            hint={`${String(WINDOW_DAYS.min)} to ${String(WINDOW_DAYS.max)} days.`}
          >
            <PillInput
              label="Stamps last, in days"
              unit="days"
              inputMode="numeric"
              width="2.5rem"
              value={form.windowDays}
              invalid={form.windowDays.trim() !== "" && windowValue === null}
              onChange={(event) => setForm({ ...form, windowDays: event.target.value })}
            />
          </SettingRow>
        </>
      ) : null}
    </SettingsBlock>
  );
}
