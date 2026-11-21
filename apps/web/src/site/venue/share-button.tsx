"use client";

import { IconCircleCheckFilled, IconShare } from "@tabler/icons-react";
import { useHud } from "../hud";

// The Clipboard API exists only on secure origins (https, localhost); elsewhere, such as the dev
// server opened on a phone by its IP, the old way: select a hidden field's text and copy it.
const copy = async (text: string) => {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Copy failed");
};

// Copies the page's link, and the HUD says so (as the app's Share does).
export function ShareButton({ url }: { url: string }) {
  const hud = useHud();
  const share = async () => {
    try {
      await copy(url);
      hud("Link copied", { leading: <IconCircleCheckFilled size={22} /> });
    } catch {
      hud("Couldn’t copy the link");
    }
  };
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-chip px-[18px] text-[15px] font-semibold"
    >
      <IconShare size={18} stroke={1.75} />
      Share
    </button>
  );
}
