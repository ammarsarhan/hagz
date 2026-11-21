"use client";

import { IconCircleCheckFilled, IconShare } from "@tabler/icons-react";
import { copy } from "../copy";
import { useHud } from "../hud";

// Copies the page's link, and the HUD says so (as the app's Share does).
export function ShareButton({
  url,
  label,
  copied,
  failed,
}: {
  url: string;
  label: string;
  copied: string;
  failed: string;
}) {
  const hud = useHud();
  const share = async () => {
    try {
      await copy(url);
      hud(copied, { leading: <IconCircleCheckFilled size={22} /> });
    } catch {
      hud(failed);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-chip px-[18px] text-[15px] font-semibold"
    >
      <IconShare size={18} stroke={1.75} />
      {label}
    </button>
  );
}
