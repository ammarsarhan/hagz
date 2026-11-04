import type { ReactNode } from "react";

// The mark from @hagz/brand at full detail (ring, pentagon and the five seams), in ink. The "small"
// detail, with a solid pentagon, is only for favicons at 32 px and under.
export function Logo() {
  return (
    <svg
      aria-label="Hagz"
      role="img"
      viewBox="-0.0725 -2.3325 32.595 32.595"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-8 text-ink"
    >
      <path
        d="M7.34 8.78 L6.87 7.73 C12.35 5.29, 22 0.4, 31.6 0.8 C27.2 1.9, 23.6 3.4, 21.6 5.2 C24.2 4.3, 26.9 4.8, 29.1 6.3 C26.4 7.7, 23.7 8.9, 21.9 9.7 C23.7 9.5, 25 10.3, 25.7 11.4 C24 13.2, 21.9 13.64, 21 18.76 L19.86 18.56 A9 9 0 0 0 7.34 8.78 Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M2 17 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0" strokeWidth="2.3" />
      <path d="M11 12 l4.76 3.45 l-1.76 5.55 h-6 l-1.76 -5.55 z" strokeWidth="1.8" />
      <path
        d="M11 12 v-3 M14 21 l2 2.4 M15.76 15.45 l2.9 -1.1 M7.24 21 l-2 2.3 M6.24 15.45 l-2.9 -1.1"
        strokeWidth="1.8"
      />
    </svg>
  );
}

// Support on WhatsApp, as in the apps: left out until NEXT_PUBLIC_SUPPORT_WHATSAPP is set.
const support = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "");

function Footer() {
  const link = "text-ink-2 underline underline-offset-2 hover:text-ink";
  return (
    <footer className="flex items-center gap-5 text-caption text-ink-3">
      <span>© {new Date().getFullYear()} Hagz</span>
      <a className={link} href="/admin/privacy">
        Privacy Policy
      </a>
      <a className={link} href="/admin/terms">
        Terms
      </a>
      {support ? (
        <a className={link} href={`https://wa.me/${support}`} target="_blank" rel="noreferrer">
          Support
        </a>
      ) : null}
    </footer>
  );
}

// Figma "A1 · Admin auth": the mark at the top, one 400-wide centred column, the footer at the bottom.
export function PageShell({
  title,
  subtitle,
  compact = false,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  // Starts higher, for the tall setup page (Figma: 64 under the mark instead of 168).
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 pt-10 pb-8">
      <Logo />
      <main className={`${compact ? "mt-16" : "mt-[18vh]"} mb-16 w-full max-w-[25rem]`}>
        <h1 className="text-center text-title font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="mt-2 text-center text-body text-ink-2">{subtitle}</p> : null}
        <div className="mt-8">{children}</div>
      </main>
      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}
