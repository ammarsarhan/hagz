import type { ReactNode } from "react";
import "@/site/site.css";
import { Footer } from "@/site/footer";
import { Header } from "@/site/header";
import { HudProvider } from "@/site/hud";

// The public site (venue pages now, area pages next): the white page with rounded bottom corners
// lifted over the light-grey footer (Figma W2, round 5). Its own stylesheet, apart from the admin's.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <HudProvider>
      <div className="min-h-screen font-sans">
        <div className="relative z-[1] rounded-b-[40px] bg-white pb-[120px]">
          <Header />
          {children}
        </div>
        <Footer />
      </div>
    </HudProvider>
  );
}
