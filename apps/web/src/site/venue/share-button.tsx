"use client";

import { IconShare } from "@tabler/icons-react";
import { useState } from "react";

// The phone's share sheet where there is one; elsewhere, the link copied, and the button says so.
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (navigator.share) {
      await navigator.share({ url, title }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-chip px-[18px] text-[15px] font-semibold"
    >
      <IconShare size={18} stroke={1.75} />
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
