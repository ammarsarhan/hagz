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
import { message, notTheirFault, send } from "@/admin/errors";
import { Field, SelectField } from "@/admin/field";
import { useHud } from "@/admin/hud";
import { basisPoints, Toggle } from "@/admin/platform/forms";
import { DetailsBlock } from "./details-block";
import { noticeLabel, paymentModeLabel, percent, policyLabel, tierLines } from "./settings";

// A venue's settings, changed in place on its admin Settings tab with the admin's own form inputs
// (the switch, Field and SelectField of the Platform forms), and saved as they change, with no Save
// button (user, 2026-11-18): a switch or a select saves at once, a typed value when the field is
// left or Enter is pressed, if it's valid. A choice that needs a value of its own (a deposit, a
// custom policy, loyalty, an own commission) starts from a sensible one, so it saves straight away.
// The block's heading says Saving… then Saved; a refused change goes to the HUD and the setting goes
// back to what's saved. Every change is on the History as the admin's.

type Request = () => Promise<{ ok: boolean; data?: AdminVenueSettings; error?: unknown }>;

interface SectionProps {
  venueId: string;
  data: AdminVenueSettings;
  // The settings a save answered with.
  onSaved: (settings: AdminVenueSettings) => void;
}

// Saving one section's changes: Saving… then Saved in its heading, and the HUD when refused, after
// which `onFailed` puts the section back as it was.
function useAutoSave(onSaved: SectionProps["onSaved"], onFailed: () => void) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const hud = useHud();
  const save = async (request: Request) => {
    setState("saving");
    const result = await request();
    if (!result.ok || !result.data) {
      setState("idle");
      onFailed();
      hud(
        message(result.error),
        notTheirFault(result.error)
          ? { label: "Try again", run: () => void save(request) }
          : undefined,
      );
      return;
    }
    setState("saved");
    onSaved(result.data);
  };
  const status =
    state === "idle" ? null : (
      <span className="text-label text-ink-3" aria-live="polite">
        {state === "saving" ? "Saving…" : "Saved"}
      </span>
    );
  return { save, status };
}

// The fields of a block, spaced like the Platform forms, their labels and hints a step larger than
// in a form panel (15 and 14): here they're the page's content, not a form's small print.
function Fields({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 py-5 [&_.text-caption]:text-label [&_.text-label]:text-body">
      {children}
    </div>
  );
}

const saveSettings = (venueId: string, body: UpdateVenueSettings): ReturnType<Request> =>
  send(api.PATCH("/v1/admin/venues/{id}/settings", { params: { path: { id: venueId } }, body }));

// A whole number in a range, or null when the text isn't one.
const wholeIn = (text: string, min: number, max: number) => {
  const value = Number(text.trim());
  return text.trim() !== "" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
};

// Saves a typed value when it's left, or on Enter.
const onCommit = (commit: () => void) => ({
  onBlur: commit,
  onKeyDown: (event: { key: string; currentTarget: HTMLInputElement }) => {
    if (event.key === "Enter") event.currentTarget.blur();
  },
});

// --- Commission ---

export function CommissionSection({ venueId, data, onSaved }: SectionProps) {
  const { override, marketplaceRate } = data.commission;
  const saved = { own: override !== null, rate: String((override ?? marketplaceRate) / 100) };
  const [form, setForm] = useState(saved);
  const { save, status } = useAutoSave(onSaved, () => setForm(saved));
  const parsed = basisPoints(form.rate);
  const put = (rate: number | null) =>
    void save(() =>
      send(
        api.PUT("/v1/admin/venues/{id}/commission", {
          params: { path: { id: venueId } },
          body: { rate },
        }),
      ),
    );

  return (
    <DetailsBlock title="Commission" action={status}>
      <Fields>
        <Toggle
          label="Its own rate"
          hint={`Off, it takes the marketplace's ${percent(marketplaceRate)} of each booking.`}
          checked={form.own}
          onChange={(own) => {
            setForm({ ...form, own });
            // On, it starts from the marketplace's rate, to change from there.
            put(own ? (parsed ?? marketplaceRate) : null);
          }}
        />
        {form.own ? (
          <Field
            label="Rate"
            hint="Hagz's share of each booking at this venue."
            inputMode="decimal"
            value={form.rate}
            onChange={(event) => setForm({ ...form, rate: event.target.value })}
            error={parsed === null ? "A percentage from 0 to 100." : undefined}
            trailing={<span className="text-label text-ink-3">%</span>}
            {...onCommit(() => {
              if (parsed !== null && parsed !== override) put(parsed);
            })}
          />
        ) : null}
      </Fields>
    </DetailsBlock>
  );
}

// --- Booking rules ---

export function BookingRulesSection({ venueId, data, onSaved }: SectionProps) {
  const saved = {
    autoConfirm: data.settings.autoConfirm,
    minimumNotice: data.settings.minimumNotice,
  };
  const [form, setForm] = useState(saved);
  const { save, status } = useAutoSave(onSaved, () => setForm(saved));
  const change = (next: typeof form) => {
    setForm(next);
    void save(() => saveSettings(venueId, next));
  };
  return (
    <DetailsBlock title="Booking rules" action={status}>
      <Fields>
        <Toggle
          label="Confirm bookings automatically"
          hint="Off, the venue's staff approve each booking."
          checked={form.autoConfirm}
          onChange={(autoConfirm) => change({ ...form, autoConfirm })}
        />
        <SelectField
          label="Booking closes"
          hint="How long before kick-off players can still book."
          value={String(form.minimumNotice)}
          options={NOTICE_CHOICES.map((minutes) => ({
            value: String(minutes),
            label: noticeLabel[minutes],
          }))}
          onChange={(event) =>
            change({ ...form, minimumNotice: Number(event.target.value) as MinimumNotice })
          }
        />
      </Fields>
    </DetailsBlock>
  );
}

// --- Payments ---

// Where a deposit starts when it's chosen.
const STARTING_DEPOSIT = 30;

export function PaymentsSection({ venueId, data, onSaved }: SectionProps) {
  const { settings } = data;
  const saved = {
    mode: settings.paymentMode,
    deposit: String(settings.depositPercent ?? STARTING_DEPOSIT),
  };
  const [form, setForm] = useState(saved);
  const { save, status } = useAutoSave(onSaved, () => setForm(saved));
  const depositValue = wholeIn(form.deposit, DEPOSIT_PERCENT.min, DEPOSIT_PERCENT.max);
  const put = (mode: PaymentMode, deposit: number | null) =>
    void save(() =>
      saveSettings(venueId, {
        paymentMode: mode,
        depositPercent: mode === "DEPOSIT" ? deposit : null,
      }),
    );

  return (
    <DetailsBlock title="Payments" action={status}>
      <Fields>
        <SelectField
          label="Players pay"
          value={form.mode}
          options={(Object.keys(paymentModeLabel) as PaymentMode[]).map((value) => ({
            value,
            label: paymentModeLabel[value],
          }))}
          onChange={(event) => {
            const mode = event.target.value as PaymentMode;
            setForm({ ...form, mode });
            put(mode, depositValue ?? STARTING_DEPOSIT);
          }}
        />
        {form.mode === "DEPOSIT" ? (
          <Field
            label="Deposit"
            hint={`The share paid online, ${String(DEPOSIT_PERCENT.min)}% to ${String(DEPOSIT_PERCENT.max)}%.`}
            inputMode="numeric"
            value={form.deposit}
            onChange={(event) => setForm({ ...form, deposit: event.target.value })}
            error={
              depositValue === null
                ? `A whole number from ${String(DEPOSIT_PERCENT.min)} to ${String(DEPOSIT_PERCENT.max)}.`
                : undefined
            }
            trailing={<span className="text-label text-ink-3">%</span>}
            {...onCommit(() => {
              if (depositValue !== null && depositValue !== settings.depositPercent)
                put("DEPOSIT", depositValue);
            })}
          />
        ) : null}
      </Fields>
    </DetailsBlock>
  );
}

// --- Cancellation ---

interface TierText {
  hours: string;
  refundPercent: string;
}

// Where a custom policy starts: the full refund up to a day before.
const STARTING_TIER: TierText = { hours: "24", refundPercent: "100" };

export function CancellationSection({ venueId, data, onSaved }: SectionProps) {
  const { settings } = data;
  const saved = {
    policy: (settings.cancellationPolicy ?? "") as CancellationPolicy | "",
    tiers:
      settings.cancellationPolicy === "CUSTOM" && settings.cancellationTiers
        ? settings.cancellationTiers.map((tier) => ({
            hours: String(tier.hours),
            refundPercent: String(tier.refundPercent),
          }))
        : [STARTING_TIER],
  };
  const [form, setForm] = useState(saved);
  const { save, status } = useAutoSave(onSaved, () => setForm(saved));
  const { policy, tiers } = form;

  const parse = (list: TierText[]) =>
    list.map((tier) => ({
      hours: wholeIn(tier.hours, 1, 336),
      refundPercent: wholeIn(tier.refundPercent, 0, 100),
    }));
  // The API's rule: less notice each time, and never a bigger refund.
  const valid = (list: TierText[]) => {
    const parsed = parse(list);
    return (
      parsed.every((tier) => tier.hours !== null && tier.refundPercent !== null) &&
      parsed.every((tier, i) => {
        const before = parsed[i - 1];
        return (
          !before ||
          ((tier.hours ?? 0) < (before.hours ?? 0) &&
            (tier.refundPercent ?? 0) <= (before.refundPercent ?? 0))
        );
      })
    );
  };
  const putCustom = (list: TierText[]) => {
    if (!valid(list)) return;
    const next = parse(list) as { hours: number; refundPercent: number }[];
    if (
      settings.cancellationPolicy === "CUSTOM" &&
      JSON.stringify(next) === JSON.stringify(settings.cancellationTiers)
    )
      return;
    void save(() =>
      saveSettings(venueId, { cancellationPolicy: "CUSTOM", cancellationTiers: next }),
    );
  };
  const setTier = (index: number, field: keyof TierText, value: string) =>
    setForm({
      ...form,
      tiers: tiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)),
    });
  const parsedTiers = parse(tiers);
  const complete = parsedTiers.every((t) => t.hours !== null && t.refundPercent !== null);

  return (
    <DetailsBlock title="Cancellation" action={status}>
      <Fields>
        <SelectField
          label="Policy"
          hint="What players get back when they cancel. A venue cancelling refunds in full."
          value={policy}
          placeholder="Choose a policy"
          options={(Object.keys(policyLabel) as CancellationPolicy[]).map((value) => ({
            value,
            label: policyLabel[value],
          }))}
          onChange={(event) => {
            const next = event.target.value as CancellationPolicy;
            setForm({ ...form, policy: next });
            if (next === "CUSTOM") putCustom(tiers);
            else
              void save(() =>
                saveSettings(venueId, { cancellationPolicy: next, cancellationTiers: null }),
              );
          }}
        />

        {policy !== "" && policy !== "CUSTOM" ? (
          <ul className="-mt-1 flex flex-col gap-1 text-label text-ink-2">
            {tierLines([...CANCELLATION_PRESETS[policy]]).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {policy === "CUSTOM" ? (
          <div className="flex flex-col gap-3">
            <p className="text-caption text-ink-2">
              Rules from the most notice to the least. Refunds never go up as notice drops.
            </p>
            {tiers.map((tier, index) => (
              <div key={index} className="flex items-end gap-3">
                <div className="flex-1">
                  <Field
                    label="Hours before kick-off"
                    inputMode="numeric"
                    value={tier.hours}
                    onChange={(event) => setTier(index, "hours", event.target.value)}
                    error={parsedTiers[index]?.hours === null ? "1 to 336." : undefined}
                    {...onCommit(() => putCustom(tiers))}
                  />
                </div>
                <div className="flex-1">
                  <Field
                    label="Refund"
                    inputMode="numeric"
                    value={tier.refundPercent}
                    onChange={(event) => setTier(index, "refundPercent", event.target.value)}
                    error={parsedTiers[index]?.refundPercent === null ? "0 to 100." : undefined}
                    trailing={<span className="text-label text-ink-3">%</span>}
                    {...onCommit(() => putCustom(tiers))}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove rule ${String(index + 1)}`}
                  disabled={tiers.length === 1}
                  onClick={() => {
                    const next = tiers.filter((_, i) => i !== index);
                    setForm({ ...form, tiers: next });
                    putCustom(next);
                  }}
                  className="mb-3 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-chip hover:text-ink disabled:cursor-default disabled:opacity-30"
                >
                  <IconTrash size={16} className="size-4" stroke={1.75} />
                </button>
              </div>
            ))}
            {complete && !valid(tiers) ? (
              <p className="text-caption font-medium text-red">
                Each rule needs less notice than the one before, and no bigger refund.
              </p>
            ) : null}
            {tiers.length < MAXIMUM_CANCELLATION_TIERS ? (
              <div>
                {/* A new rule saves once it's filled in. */}
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() =>
                    setForm({ ...form, tiers: [...tiers, { hours: "", refundPercent: "" }] })
                  }
                >
                  Add a rule
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Fields>
    </DetailsBlock>
  );
}

// --- Loyalty ---

const STAMPS = { min: 2, max: 20 } as const;
const WINDOW_DAYS = { min: 1, max: 365 } as const;

export function LoyaltySection({ venueId, data, onSaved }: SectionProps) {
  const { loyalty } = data.settings;
  const saved = {
    on: loyalty !== null,
    stamps: String(loyalty?.stamps ?? 10),
    windowDays: String(loyalty?.windowDays ?? 90),
  };
  const [form, setForm] = useState(saved);
  const { save, status } = useAutoSave(onSaved, () => setForm(saved));
  const stampsValue = wholeIn(form.stamps, STAMPS.min, STAMPS.max);
  const windowValue = wholeIn(form.windowDays, WINDOW_DAYS.min, WINDOW_DAYS.max);
  const putOn = () => {
    if (stampsValue === null || windowValue === null) return;
    if (loyalty?.stamps === stampsValue && loyalty.windowDays === windowValue) return;
    void save(() =>
      saveSettings(venueId, { loyalty: { stamps: stampsValue, windowDays: windowValue } }),
    );
  };

  return (
    <DetailsBlock title="Loyalty" action={status}>
      <Fields>
        <Toggle
          label="Loyalty rewards"
          hint="Players collect a stamp per booking and get one free."
          checked={form.on}
          onChange={(on) => {
            setForm({ ...form, on });
            if (on) putOn();
            else void save(() => saveSettings(venueId, { loyalty: null }));
          }}
        />
        {form.on ? (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Bookings per free one"
              hint={`${String(STAMPS.min)} to ${String(STAMPS.max)}.`}
              inputMode="numeric"
              value={form.stamps}
              onChange={(event) => setForm({ ...form, stamps: event.target.value })}
              error={stampsValue === null ? "A whole number in range." : undefined}
              {...onCommit(putOn)}
            />
            <Field
              label="Stamps last"
              hint={`${String(WINDOW_DAYS.min)} to ${String(WINDOW_DAYS.max)} days.`}
              inputMode="numeric"
              value={form.windowDays}
              onChange={(event) => setForm({ ...form, windowDays: event.target.value })}
              error={windowValue === null ? "A whole number in range." : undefined}
              trailing={<span className="text-label text-ink-3">days</span>}
              {...onCommit(putOn)}
            />
          </div>
        ) : null}
      </Fields>
    </DetailsBlock>
  );
}
