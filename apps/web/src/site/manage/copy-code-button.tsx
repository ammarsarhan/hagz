"use client";

import { IconCircleCheckFilled, IconCopy } from "@tabler/icons-react";
import { copy } from "../copy";
import { useHud } from "../hud";

// Under the invitation code: copies it for the app's "Have a code?", and the HUD says so.
export function CopyCodeButton({
  code,
  label,
  copied,
  failed,
}: {
  code: string;
  label: string;
  copied: string;
  failed: string;
}) {
  const hud = useHud();
  const copyCode = async () => {
    try {
      await copy(code);
      hud(copied, { leading: <IconCircleCheckFilled size={22} /> });
    } catch {
      hud(failed);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copyCode()}
      className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-label font-semibold underline underline-offset-4 hover:opacity-70"
    >
      <IconCopy size={16} stroke={1.75} />
      {label}
    </button>
  );
}
