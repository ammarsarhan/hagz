"use client";

import type { AdminDetails, AdminDevice } from "@hagz/contracts";
import {
  IconDeviceDesktop,
  IconDeviceMobile,
  IconEye,
  IconEyeOff,
  IconLock,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/admin/api";
import { Avatar } from "@/admin/avatar";
import { ago, day, device, useAdminDetails } from "@/admin/admins/model";
import { Button } from "@/admin/button";
import { Skeleton, Tag } from "@/admin/data-table";
import { ConfirmDialog } from "@/admin/dialog";
import { message, notTheirFault, problemCode, send } from "@/admin/errors";
import { Field } from "@/admin/field";
import { useHud } from "@/admin/hud";
import { PageHeader } from "@/admin/page-header";
import { signOut, useAdmin, useUpdateAdmin } from "@/admin/session";
import { TabPanel, Tabs } from "@/admin/tabs";

// The signed-in admin's own account, option 3 of Figma A4 (Tabs, after Acctual and Railway, picked
// 2026-11-11): Profile, Security and Browsers under the title, each a narrow column of sections.
// Profile opens with an identity header (3A, picked the same day) over its sections.
// The email is the sign-in and stays as invited; a lost authenticator is reset by another admin.

const MIN_PASSWORD = 8;

type TabId = "profile" | "security" | "browsers";

// A titled block in a tab, with a line under the title; sections after the first sit below a hairline.
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border pt-8 first:border-t-0 first:pt-0 [&+&]:mt-8">
      <h2 className="text-body font-semibold text-ink">{title}</h2>
      <p className="mt-0.5 text-label text-ink-2">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// The eye at the end of a password field, as on sign in: the open eye while the password shows.
function Reveal({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={shown ? "Hide password" : "Show password"}
      onClick={onToggle}
      className="flex cursor-pointer text-unit hover:text-ink"
    >
      {shown ? (
        <IconEye size={20} className="size-5 shrink-0" stroke={2} />
      ) : (
        <IconEyeOff size={20} className="size-5 shrink-0" stroke={2} />
      )}
    </button>
  );
}

// Only failures that aren't the admin's fault are worth trying again as they are.
const useFailure = () => {
  const hud = useHud();
  return (error: unknown, retry: () => void) =>
    hud(message(error), notTheirFault(error) ? { label: "Try again", run: retry } : undefined);
};

function ProfileTab({ details }: { details: AdminDetails | undefined }) {
  const admin = useAdmin();
  const updateAdmin = useUpdateAdmin();
  const fail = useFailure();
  const [name, setName] = useState(admin.name);
  const [busy, setBusy] = useState(false);
  const changed = name.trim() !== admin.name;
  const empty = name.trim() === "";

  const save = async () => {
    setBusy(true);
    const result = await send(api.PATCH("/v1/auth/admin/me", { body: { name: name.trim() } }));
    setBusy(false);
    if (!result.ok) return fail(result.error, () => void save());
    updateAdmin(result.data);
    setName(result.data.name);
  };

  return (
    <>
      {/* Who's signed in, as option 2's header (Figma 3A): the initials, name and email. */}
      <div className="flex items-center gap-5 border-b border-border pb-8">
        <Avatar name={admin.name} size="large" />
        <div className="min-w-0">
          <p className="truncate text-[1.375rem] leading-7 font-semibold text-ink">{admin.name}</p>
          <p className="truncate text-body text-ink-2">{admin.email}</p>
        </div>
      </div>

      <div className="mt-8">
        <Section title="Profile" description="How other admins see you, in the admin list.">
          <form
            className="flex flex-col gap-5"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (changed && !empty && !busy) void save();
            }}
          >
            <Field
              label="Name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={empty ? "Your name can't be empty." : undefined}
            />
            <Field
              label="Email address"
              type="email"
              value={admin.email}
              disabled
              readOnly
              hint="Your sign-in. It stays the address you were invited at."
              trailing={<IconLock size={18} className="size-[1.125rem] shrink-0 text-ink-3" />}
            />
            <div>
              <Button type="submit" size="small" loading={busy} disabled={!changed || empty}>
                Save changes
              </Button>
            </div>
          </form>
        </Section>

        <Section title="Membership" description="When you joined the admin.">
          {details ? (
            <p className="text-label text-ink">
              Admin since {day(details.createdAt)}
              <span className="text-ink-2">
                {details.invitedBy ? ` · invited by ${details.invitedBy}` : " · the first admin"}
              </span>
            </p>
          ) : (
            <Skeleton className="h-4 w-56" />
          )}
        </Section>
      </div>
    </>
  );
}

function SecurityTab({
  details,
  reload,
}: {
  details: AdminDetails | undefined;
  // The other browsers are signed out, so Browsers' count changes.
  reload: () => void;
}) {
  const fail = useFailure();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [shown, setShown] = useState({ current: false, next: false });
  const [wrong, setWrong] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const valid = current !== "" && next.length >= MIN_PASSWORD;

  const change = async () => {
    setBusy(true);
    setWrong(undefined);
    const result = await send(
      api.POST("/v1/auth/admin/me/password", {
        body: { currentPassword: current, newPassword: next },
      }),
    );
    setBusy(false);
    if (!result.ok) {
      if (problemCode(result.error) === "WRONG_PASSWORD") return setWrong(message(result.error));
      return fail(result.error, () => void change());
    }
    setCurrent("");
    setNext("");
    setShown({ current: false, next: false });
    setDone(true);
    reload();
  };

  return (
    <>
      <Section title="Password" description="Changing it signs your other browsers out.">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (valid && !busy) void change();
          }}
        >
          <Field
            label="Current password"
            type={shown.current ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your current password"
            value={current}
            onChange={(event) => {
              setCurrent(event.target.value);
              setWrong(undefined);
              setDone(false);
            }}
            error={wrong}
            trailing={
              <Reveal
                shown={shown.current}
                onToggle={() => setShown((was) => ({ ...was, current: !was.current }))}
              />
            }
          />
          <Field
            label="New password"
            type={shown.next ? "text" : "password"}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD} characters`}
            value={next}
            onChange={(event) => {
              setNext(event.target.value);
              setDone(false);
            }}
            hint={
              next !== "" && next.length < MIN_PASSWORD
                ? `At least ${MIN_PASSWORD} characters.`
                : undefined
            }
            trailing={
              <Reveal
                shown={shown.next}
                onToggle={() => setShown((was) => ({ ...was, next: !was.next }))}
              />
            }
          />
          <div className="flex items-center gap-4">
            <Button type="submit" size="small" loading={busy} disabled={!valid}>
              Update password
            </Button>
            {done ? (
              <p role="status" className="text-label text-ink-2">
                Password updated. Your other browsers are signed out.
              </p>
            ) : null}
          </div>
        </form>
      </Section>

      <Section
        title="Two-step sign-in"
        description="A code from your authenticator app after your password."
      >
        <div className="flex items-center gap-3 border-y border-border py-3">
          <IconShieldCheck size={20} className="size-5 shrink-0 text-ink-2" stroke={1.75} />
          <span className="flex-1 text-label text-ink">Authenticator app</span>
          {details ? (
            details.authenticatorSetUp ? (
              <Tag tone="on">On</Tag>
            ) : (
              <Tag>Off</Tag>
            )
          ) : (
            <Skeleton className="h-5 w-9" />
          )}
        </div>
        <p className="mt-4 text-caption text-ink-2">
          Lost your phone? Ask another admin to reset it from the Admins page.
        </p>
      </Section>
    </>
  );
}

const mobile = (userAgent: string | null) => /iPhone|iPad|Android/.test(userAgent ?? "");

function BrowserRow({ session, action }: { session: AdminDevice; action: ReactNode }) {
  const Icon = mobile(session.userAgent) ? IconDeviceMobile : IconDeviceDesktop;
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-field text-ink-2">
        <Icon size={18} className="size-[1.125rem]" stroke={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-label text-ink">
          <span className="truncate">{device(session.userAgent)}</span>
          {session.current ? <Tag>This browser</Tag> : null}
        </p>
        <p className="mt-0.5 truncate text-caption text-ink-2">
          {session.ipAddress ?? "Unknown address"} ·{" "}
          {session.current ? "active now" : `active ${ago(session.lastActiveAt)}`}
        </p>
      </div>
      {action}
    </li>
  );
}

function BrowsersTab({
  details,
  reload,
}: {
  details: AdminDetails | undefined;
  reload: () => void;
}) {
  const fail = useFailure();
  const [ending, setEnding] = useState<string>();
  const [confirmAll, setConfirmAll] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const end = async (id: string) => {
    setEnding(id);
    const result = await send(
      api.DELETE("/v1/auth/admin/me/sessions/{id}", { params: { path: { id } } }),
    );
    setEnding(undefined);
    // Already signed out elsewhere is what was wanted; the list just catches up.
    if (!result.ok && problemCode(result.error) !== "SESSION_NOT_FOUND") {
      return fail(result.error, () => void end(id));
    }
    reload();
  };

  if (!details) {
    return (
      <ul>
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 border-b border-border py-3">
            <Skeleton className="size-9" />
            <div className="flex-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-1.5 h-3 w-28" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const others = details.devices.filter((session) => !session.current);
  const here = details.devices.find((session) => session.current);

  return (
    <>
      <Section title="Signed in on" description="Sign out of any browser you don't recognise.">
        <ul className="border-t border-border">
          {here ? (
            <BrowserRow
              session={here}
              action={
                <Button
                  size="small"
                  variant="secondary"
                  loading={signingOut}
                  onClick={() => {
                    setSigningOut(true);
                    void signOut();
                  }}
                >
                  Sign out
                </Button>
              }
            />
          ) : null}
          {others.map((session) => (
            <BrowserRow
              key={session.id}
              session={session}
              action={
                <Button
                  size="small"
                  variant="secondary"
                  loading={ending === session.id}
                  onClick={() => void end(session.id)}
                >
                  Sign out
                </Button>
              }
            />
          ))}
        </ul>
        {others.length > 1 ? (
          <div className="mt-5">
            <Button size="small" variant="secondary" onClick={() => setConfirmAll(true)}>
              Sign out of other browsers
            </Button>
          </div>
        ) : null}
      </Section>

      {confirmAll ? (
        <ConfirmDialog
          title="Sign out of other browsers?"
          description={`You'll stay signed in here. The other ${others.length} will need your password and a code to get back in.`}
          confirmLabel="Sign out"
          request={() => send(api.DELETE("/v1/auth/admin/me/sessions"))}
          onClose={() => setConfirmAll(false)}
          onDone={reload}
        />
      ) : null}
    </>
  );
}

export default function Account() {
  const admin = useAdmin();
  const { details, reload } = useAdminDetails(admin.id);
  const [tab, setTab] = useState<TabId>("profile");

  return (
    <>
      <PageHeader title="Account" subtitle="Your admin account and how you sign in." />

      <div className="mt-6">
        <Tabs
          label="Account"
          value={tab}
          onChange={setTab}
          items={[
            { id: "profile", label: "Profile" },
            { id: "security", label: "Security" },
            { id: "browsers", label: "Browsers", count: details?.devices.length },
          ]}
        />
        {/* Half the page wide on a desktop; the whole width once that would be too narrow. */}
        <div className="mt-8 lg:w-1/2">
          {tab === "profile" ? (
            <TabPanel id="profile">
              <ProfileTab details={details} />
            </TabPanel>
          ) : tab === "security" ? (
            <TabPanel id="security">
              <SecurityTab details={details} reload={reload} />
            </TabPanel>
          ) : (
            <TabPanel id="browsers">
              <BrowsersTab details={details} reload={reload} />
            </TabPanel>
          )}
        </div>
      </div>
    </>
  );
}
