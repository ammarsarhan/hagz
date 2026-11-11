"use client";

import { useState } from "react";
import { message, notTheirFault } from "./errors";
import { useHud } from "./hud";

// What every modal and panel does when it sends something.

type Close = () => void;
type Done = () => void;

// Shared submit plumbing: busy while waiting, close and reload on success. Every failure shows in
// the HUD, over the modal, which stays open with what was typed. When it isn't the admin's fault
// (no answer, a server error) the HUD has Try again, which sends the same request again; a refused
// request would only be refused again, so the admin fixes the form instead.
export const useSubmit = (onDone: Done, onClose: Close) => {
  const [busy, setBusy] = useState(false);
  const hud = useHud();
  const run = async (request: () => Promise<{ ok: boolean; error?: unknown }>) => {
    setBusy(true);
    const result = await request();
    setBusy(false);
    if (!result.ok) {
      hud(
        message(result.error),
        notTheirFault(result.error)
          ? { label: "Try again", run: () => void run(request) }
          : undefined,
      );
      return;
    }
    onClose();
    onDone();
  };
  return { busy, run };
};
