import { APPS, schemeFor } from "@hagz/contracts";
import { IconExternalLink } from "@tabler/icons-react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { appEnv } from "@/lib/env";
import { origin } from "../origin";
import { StoreBadges } from "../store-badges";
import { CopyCodeButton } from "./copy-code-button";
import { pathIn, wordsFor, type Locale } from "../words";

// What a staff link (/manage/...) shows when Hagz Dashboard isn't installed to open it (Figma W3,
// option A, in the site's shell). With the app installed and the domain verified, the phone opens
// the link in the app and never gets here. An invitation (/manage/invite/CODE) gets the steps to
// join, ending in its code for the app's "Have a code?"; any other link just opens the app.

const APP = APPS.dashboard.name;

// The invitation's code, when the link carries one that looks like a code.
const codeIn = (path: string[]) =>
  path[0] === "invite" && path[1] && /^[A-Za-z0-9]{4,12}$/.test(path[1])
    ? path[1].toUpperCase()
    : null;

export function manageMetadata(path: string[], locale: Locale): Metadata {
  const { manage: words } = wordsFor(locale);
  return {
    title: path[0] === "invite" ? words.invitedMeta(APP) : words.otherMeta(APP),
    // Invitations are personal: keep them out of search engines.
    robots: { index: false, follow: false },
  };
}

export async function ManagePage({ path, locale }: { path: string[]; locale: Locale }) {
  const { manage: words } = wordsFor(locale);
  const invitation = path[0] === "invite";
  const code = codeIn(path);
  const joined = path.map(encodeURIComponent).join("/");
  const appUrl = `${schemeFor("dashboard", appEnv)}://manage/${joined}`;
  // The QR opens this same page on a phone, where the app (or its store) takes it from there.
  const pageUrl = `${await origin()}${pathIn(locale, `/manage/${joined}`)}`;
  const qrSvg = await QRCode.toString(pageUrl, { type: "svg", margin: 0 });

  return (
    <main className="mx-auto flex w-full max-w-[1120px] items-start justify-between gap-12 px-6 pt-6 lg:pt-[72px] xl:px-0">
      <div className="flex w-full max-w-[560px] flex-col">
        <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.02em] lg:text-[40px] lg:leading-[46px] rtl:tracking-normal">
          {invitation ? words.invitedTitle : words.otherTitle(APP)}
        </h1>
        <p className="mt-3 text-subtitle text-ink-2">
          {invitation ? words.invitedLine(APP) : words.otherLine}
        </p>
        <a
          href={appUrl}
          className="mt-7 flex h-11 items-center justify-center gap-2 rounded-full bg-blue px-5 text-body font-semibold text-white self-start"
        >
          <IconExternalLink size={17} stroke={2} className="rtl:-scale-x-100" />
          {words.open}
        </a>
        <div className="mt-9 h-px bg-border" />
        <h2 className="mt-9 text-[18px] leading-6 font-semibold">{words.noApp}</h2>
        {invitation ? (
          <ol className="mt-6 flex flex-col gap-7">
            <Step number={1}>
              <div className="text-subtitle font-medium">{words.install(APP)}</div>
              <div className="mt-3">
                <StoreBadges locale={locale} />
              </div>
            </Step>
            <Step number={2}>
              <div className="text-subtitle font-medium">{words.signIn}</div>
              <div className="mt-1 text-label text-ink-2">{words.signInLine}</div>
            </Step>
            <Step number={3}>
              <div className="text-subtitle font-medium">{words.openAgain}</div>
              {code ? (
                <>
                  <div className="mt-1 text-label text-ink-2">
                    {words.codeBefore}
                    <span className="font-medium text-ink">{words.haveCode}</span>
                    {words.codeAfter}
                  </div>
                  <div>
                    <Code code={code} label={words.codeLabel(code)} />
                  </div>
                  <CopyCodeButton
                    code={code}
                    label={words.copyCode}
                    copied={words.codeCopied}
                    failed={words.copyCodeFailed}
                  />
                </>
              ) : null}
            </Step>
          </ol>
        ) : (
          <div className="mt-4">
            <StoreBadges locale={locale} />
          </div>
        )}
      </div>
      {/* On a computer (WhatsApp Web, say): carry the link to the phone. */}
      <div className="hidden w-[340px] shrink-0 flex-col items-center gap-5 rounded-[20px] border border-border p-8 lg:flex">
        <div
          role="img"
          aria-label={words.qrLabel}
          className="size-[200px] rounded-2xl border border-border p-4 [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="text-subtitle font-medium">{words.qrTitle}</div>
          <div className="max-w-[260px] text-label text-ink-2">
            {invitation ? words.qrLine(APP) : words.qrLineOther(APP)}
          </div>
        </div>
      </div>
    </main>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-chip text-label font-semibold">
        {number}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

// The code in six boxes, like the app's code entry, to type under "Have a code?".
function Code({ code, label }: { code: string; label: string }) {
  return (
    // Left to right in either language, but at the step's start: in Arabic, under its text on the right.
    <div role="img" aria-label={label} dir="ltr" className="mt-3 inline-flex gap-[7px] sm:gap-2">
      {[...code].map((char, index) => (
        <span
          key={index}
          className="flex h-12 w-10 items-center justify-center rounded-xl border border-[#DADDE2] text-[20px] font-semibold sm:h-[54px] sm:w-[46px] sm:text-[22px]"
        >
          {char}
        </span>
      ))}
    </div>
  );
}
