import type { ReactNode } from "react";
import { Footer } from "./footer";
import { Header } from "./header";
import { HudProvider } from "./hud";
import { dirOf, type Locale } from "./words";

// The public site's frame in one language: the white page with rounded bottom corners lifted over
// the light-grey footer (Figma W2, round 5). The language and direction are set here, on the page,
// as the root layout's <html> is shared with the admin.
export function SiteShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const dir = dirOf(locale);
  return (
    <HudProvider dir={dir}>
      <div lang={locale} dir={dir} className="min-h-screen font-sans">
        <div className="relative z-[1] rounded-b-[40px] bg-white pb-[120px]">
          <Header locale={locale} />
          {children}
        </div>
        <Footer locale={locale} />
      </div>
    </HudProvider>
  );
}
