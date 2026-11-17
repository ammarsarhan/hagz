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
import { Field, SelectField } from "@/admin/field";
import { basisPoints, Toggle } from "@/admin/platform/forms";
import { PanelSection, SidePanel } from "@/admin/side-panel";
import { useSubmit } from "@/admin/submit";
import { noticeLabel, paymentModeLabel, percent, policyLabel, tierLines } from "./settings";

// The side panels that change a venue's settings from its admin Settings tab, one per section. Each
// sends only its own fields, and Save stays grey until something differs and is valid. The owner's
// settings go through the same checks as in the staff app, and every change is on the History.

interface PanelProps {
  venueId: string;
  data: AdminVenueSettings;
  onClose: () => void;
  onDone: () => void;
}

// The frame every settings panel shares: the slide-in panel, Cancel and Save, and the request.
function SettingsPanel({
  title,
  description,
  ready,
  request,
  onClose,
  onDone,
  children,
}: {
  title: string;
  description: string;
  ready: boolean;
  request: () => Promise<{ ok: boolean; error?: unknown }>;
  onClose: () => void;
  onDone: () => void;
  children: ReactNode;
}) {
  // Closing slides the panel out first; onClose (which removes it) runs once it's gone.
  const [open, setOpen] = useState(true);
  const hide = () => setOpen(false);
  const { busy, run } = useSubmit(onDone, hide);
  return (
    <SidePanel
      open={open}
      onRequestClose={hide}
      onExited={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" size="small" onClick={hide} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="small"
            loading={busy}
            disabled={!ready}
            onClick={() => ready && void run(request)}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">{children}</div>
    </SidePanel>
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

export function CommissionPanel({ venueId, data, onClose, onDone }: PanelProps) {
  const { override, marketplaceRate } = data.commission;
  const [own, setOwn] = useState(override !== null);
  const [rate, setRate] = useState(override === null ? "" : String(override / 100));
  const parsed = basisPoints(rate);
  const next = own ? parsed : null;
  const ready = (!own || parsed !== null) && next !== override;
  return (
    <SettingsPanel
      title="Commission"
      description="Hagz's share of each booking at this venue."
      ready={ready}
      request={() =>
        send(
          api.PUT("/v1/admin/venues/{id}/commission", {
            params: { path: { id: venueId } },
            body: { rate: next },
          }),
        )
      }
      onClose={onClose}
      onDone={onDone}
    >
      <Toggle
        label="Its own rate"
        hint={`Off, it takes the marketplace's ${percent(marketplaceRate)}.`}
        checked={own}
        onChange={setOwn}
      />
      {own ? (
        <Field
          label="Rate"
          asterisk
          required
          inputMode="decimal"
          value={rate}
          placeholder={String(marketplaceRate / 100)}
          onChange={(event) => setRate(event.target.value)}
          error={rate.trim() !== "" && parsed === null ? "A percentage from 0 to 100." : undefined}
          trailing={<span className="text-label text-ink-3">%</span>}
        />
      ) : null}
    </SettingsPanel>
  );
}

// --- Booking rules ---

export function BookingRulesPanel({ venueId, data, onClose, onDone }: PanelProps) {
  const { settings } = data;
  const [autoConfirm, setAutoConfirm] = useState(settings.autoConfirm);
  const [notice, setNotice] = useState<MinimumNotice>(settings.minimumNotice);
  const ready = autoConfirm !== settings.autoConfirm || notice !== settings.minimumNotice;
  return (
    <SettingsPanel
      title="Booking rules"
      description="How players' bookings are confirmed, and how late they can book."
      ready={ready}
      request={() => saveSettings(venueId, { autoConfirm, minimumNotice: notice })}
      onClose={onClose}
      onDone={onDone}
    >
      <Toggle
        label="Confirm bookings automatically"
        hint="Off, the venue's staff approve each booking."
        checked={autoConfirm}
        onChange={setAutoConfirm}
      />
      <SelectField
        label="Booking closes"
        hint="How long before kick-off players can still book."
        value={String(notice)}
        options={NOTICE_CHOICES.map((minutes) => ({
          value: String(minutes),
          label: noticeLabel[minutes],
        }))}
        onChange={(event) => setNotice(Number(event.target.value) as MinimumNotice)}
      />
    </SettingsPanel>
  );
}

// --- Payments ---

export function PaymentsPanel({ venueId, data, onClose, onDone }: PanelProps) {
  const { settings } = data;
  const [mode, setMode] = useState<PaymentMode>(settings.paymentMode);
  const [deposit, setDeposit] = useState(
    settings.depositPercent === null ? "" : String(settings.depositPercent),
  );
  const depositValue = wholeIn(deposit, DEPOSIT_PERCENT.min, DEPOSIT_PERCENT.max);
  const nextDeposit = mode === "DEPOSIT" ? depositValue : null;
  const ready =
    (mode !== "DEPOSIT" || depositValue !== null) &&
    (mode !== settings.paymentMode || nextDeposit !== settings.depositPercent);
  return (
    <SettingsPanel
      title="Payments"
      description="How players pay for their bookings."
      ready={ready}
      request={() => saveSettings(venueId, { paymentMode: mode, depositPercent: nextDeposit })}
      onClose={onClose}
      onDone={onDone}
    >
      <SelectField
        label="Players pay"
        value={mode}
        options={(Object.keys(paymentModeLabel) as PaymentMode[]).map((value) => ({
          value,
          label: paymentModeLabel[value],
        }))}
        onChange={(event) => setMode(event.target.value as PaymentMode)}
      />
      {mode === "DEPOSIT" ? (
        <Field
          label="Deposit"
          asterisk
          required
          inputMode="numeric"
          hint={`The share paid online, ${String(DEPOSIT_PERCENT.min)}% to ${String(DEPOSIT_PERCENT.max)}%.`}
          value={deposit}
          onChange={(event) => setDeposit(event.target.value)}
          error={
            deposit.trim() !== "" && depositValue === null
              ? `A whole number from ${String(DEPOSIT_PERCENT.min)} to ${String(DEPOSIT_PERCENT.max)}.`
              : undefined
          }
          trailing={<span className="text-label text-ink-3">%</span>}
        />
      ) : null}
    </SettingsPanel>
  );
}

// --- Cancellation ---

interface TierText {
  hours: string;
  refundPercent: string;
}

export function CancellationPanel({ venueId, data, onClose, onDone }: PanelProps) {
  const { settings } = data;
  const [policy, setPolicy] = useState<CancellationPolicy | "">(settings.cancellationPolicy ?? "");
  const [tiers, setTiers] = useState<TierText[]>(
    (settings.cancellationPolicy === "CUSTOM" && settings.cancellationTiers
      ? settings.cancellationTiers
      : [{ hours: 24, refundPercent: 100 }]
    ).map((tier) => ({ hours: String(tier.hours), refundPercent: String(tier.refundPercent) })),
  );

  const parsed = tiers.map((tier) => ({
    hours: wholeIn(tier.hours, 1, 336),
    refundPercent: wholeIn(tier.refundPercent, 0, 100),
  }));
  const tiersValid =
    parsed.every((tier) => tier.hours !== null && tier.refundPercent !== null) &&
    // The API's rule: less notice each time, and never a bigger refund.
    parsed.every((tier, i) => {
      const before = parsed[i - 1];
      return (
        !before ||
        ((tier.hours ?? 0) < (before.hours ?? 0) &&
          (tier.refundPercent ?? 0) <= (before.refundPercent ?? 0))
      );
    });
  const customTiers = parsed as { hours: number; refundPercent: number }[];
  const changed =
    policy !== (settings.cancellationPolicy ?? "") ||
    (policy === "CUSTOM" &&
      JSON.stringify(customTiers) !== JSON.stringify(settings.cancellationTiers));
  const ready = policy !== "" && (policy !== "CUSTOM" || tiersValid) && changed;

  const setTier =
    (index: number, field: keyof TierText) => (event: { target: { value: string } }) =>
      setTiers(
        tiers.map((tier, i) => (i === index ? { ...tier, [field]: event.target.value } : tier)),
      );

  return (
    <SettingsPanel
      title="Cancellation"
      description="What players get back when they cancel. A venue cancelling always refunds in full."
      ready={ready}
      request={() =>
        policy === ""
          ? Promise.resolve({ ok: false })
          : saveSettings(venueId, {
              cancellationPolicy: policy,
              cancellationTiers: policy === "CUSTOM" ? customTiers : null,
            })
      }
      onClose={onClose}
      onDone={onDone}
    >
      <SelectField
        label="Policy"
        value={policy}
        placeholder="Choose a policy"
        options={(Object.keys(policyLabel) as CancellationPolicy[]).map((value) => ({
          value,
          label: policyLabel[value],
        }))}
        onChange={(event) => setPolicy(event.target.value as CancellationPolicy)}
      />
      {policy !== "" && policy !== "CUSTOM" ? (
        <ul className="flex flex-col gap-1 text-label text-ink-2">
          {tierLines([...CANCELLATION_PRESETS[policy]]).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {policy === "CUSTOM" ? (
        <PanelSection title="Rules">
          <p className="-mt-1.5 text-caption text-ink-2">
            From the most notice to the least. Refunds never go up as notice drops.
          </p>
          {tiers.map((tier, index) => (
            <div key={index} className="flex items-end gap-3">
              <div className="flex-1">
                <Field
                  label="Hours before"
                  inputMode="numeric"
                  value={tier.hours}
                  onChange={setTier(index, "hours")}
                />
              </div>
              <div className="flex-1">
                <Field
                  label="Refund"
                  inputMode="numeric"
                  value={tier.refundPercent}
                  onChange={setTier(index, "refundPercent")}
                  trailing={<span className="text-label text-ink-3">%</span>}
                />
              </div>
              <button
                type="button"
                aria-label="Remove this rule"
                disabled={tiers.length === 1}
                onClick={() => setTiers(tiers.filter((_, i) => i !== index))}
                className="mb-3 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-chip hover:text-ink disabled:cursor-default disabled:opacity-30"
              >
                <IconTrash size={16} className="size-4" stroke={1.75} />
              </button>
            </div>
          ))}
          {tiers.length < MAXIMUM_CANCELLATION_TIERS ? (
            <div>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setTiers([...tiers, { hours: "", refundPercent: "" }])}
              >
                Add a rule
              </Button>
            </div>
          ) : null}
          {!tiersValid && tiers.every((tier) => tier.hours && tier.refundPercent) ? (
            <p className="text-caption font-medium text-red">
              Each rule needs less notice than the one before, and no bigger refund.
            </p>
          ) : null}
        </PanelSection>
      ) : null}
    </SettingsPanel>
  );
}

// --- Loyalty ---

const STAMPS = { min: 2, max: 20 } as const;
const WINDOW_DAYS = { min: 1, max: 365 } as const;

export function LoyaltyPanel({ venueId, data, onClose, onDone }: PanelProps) {
  const { loyalty } = data.settings;
  const [on, setOn] = useState(loyalty !== null);
  const [stamps, setStamps] = useState(String(loyalty?.stamps ?? 10));
  const [windowDays, setWindowDays] = useState(String(loyalty?.windowDays ?? 90));
  const stampsValue = wholeIn(stamps, STAMPS.min, STAMPS.max);
  const windowValue = wholeIn(windowDays, WINDOW_DAYS.min, WINDOW_DAYS.max);
  const next =
    on && stampsValue !== null && windowValue !== null
      ? { stamps: stampsValue, windowDays: windowValue }
      : null;
  const ready = (!on || next !== null) && JSON.stringify(next) !== JSON.stringify(loyalty);
  return (
    <SettingsPanel
      title="Loyalty"
      description="A free booking for players who keep coming back."
      ready={ready}
      request={() => saveSettings(venueId, { loyalty: next })}
      onClose={onClose}
      onDone={onDone}
    >
      <Toggle
        label="Loyalty rewards"
        hint="Players collect a stamp per booking and get one free."
        checked={on}
        onChange={setOn}
      />
      {on ? (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Bookings per free one"
            asterisk
            required
            inputMode="numeric"
            hint={`${String(STAMPS.min)} to ${String(STAMPS.max)}.`}
            value={stamps}
            onChange={(event) => setStamps(event.target.value)}
          />
          <Field
            label="Stamps last"
            asterisk
            required
            inputMode="numeric"
            hint={`${String(WINDOW_DAYS.min)} to ${String(WINDOW_DAYS.max)} days.`}
            value={windowDays}
            onChange={(event) => setWindowDays(event.target.value)}
            trailing={<span className="text-label text-ink-3">days</span>}
          />
        </div>
      ) : null}
    </SettingsPanel>
  );
}
