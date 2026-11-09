import type { ReactNode } from "react";
import { HudProvider } from "@/admin/hud";
import { Rail } from "@/admin/rail";
import { AdminSession } from "@/admin/session";

// Every signed-in admin page: the rail on the left, the page on the right. Sign in, accepting an
// invitation and the policy pages sit outside this group, so they have no rail.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AdminSession>
      <HudProvider>
        <div className="flex min-h-screen">
          <Rail />
          <main className="min-w-0 flex-1 px-10 pt-10 pb-16">{children}</main>
        </div>
      </HudProvider>
    </AdminSession>
  );
}
