"use client";

import { IconAlertCircleFilled, IconX } from "@tabler/icons-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// Errors: a white pill with red text and icon at the bottom centre of the window, over
// everything, fading in and out and gone after a few seconds. Every modal's errors show here; ones
// that aren't the admin's fault (no connection, the server broke) add Try again. See notTheirFault
// in errors.ts.
//
// An open modal <dialog> makes the rest of the page inert, so a HUD outside it would show but
// couldn't be clicked. It's drawn inside the topmost open dialog instead, or on the page if none.

const VISIBLE_MS = 5000;
// Longer when there's something to press.
const WITH_ACTION_MS = 8000;
// How long it takes to fade out (.hud-leaving in admin.css) before it's removed.
const FADE_MS = 160;

export interface HudAction {
  label: string;
  run: () => void;
}

interface Showing {
  message: string;
  action?: HudAction;
  key: number;
  // Fading out; removed once the fade is done.
  leaving?: boolean;
}

const HudContext = createContext<((message: string, action?: HudAction) => void) | null>(null);

export const useHud = () => {
  const show = useContext(HudContext);
  if (!show) throw new Error("useHud needs HudProvider");
  return show;
};

export function HudProvider({ children }: { children: ReactNode }) {
  const [showing, setShowing] = useState<Showing>();
  const [target, setTarget] = useState<Element>();

  const show = useCallback((message: string, action?: HudAction) => {
    const dialogs = document.querySelectorAll("dialog[open]");
    setTarget(dialogs[dialogs.length - 1] ?? document.body);
    setShowing((was) => ({ message, action, key: (was?.key ?? 0) + 1 }));
  }, []);

  const dismiss = useCallback(
    () => setShowing((was) => (was && !was.leaving ? { ...was, leaving: true } : was)),
    [],
  );

  // Each new message restarts the clock: shown for a while, then faded out, then removed. A new
  // message while one fades out replaces it straight away.
  useEffect(() => {
    if (!showing) return;
    const timer = showing.leaving
      ? setTimeout(() => setShowing(undefined), FADE_MS)
      : setTimeout(dismiss, showing.action ? WITH_ACTION_MS : VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [showing, dismiss]);

  const value = useMemo(() => show, [show]);
  return (
    <HudContext.Provider value={value}>
      {children}
      {showing && target
        ? createPortal(
            <Hud
              key={showing.key}
              message={showing.message}
              action={showing.action}
              leaving={showing.leaving ?? false}
              onClose={dismiss}
            />,
            target,
          )
        : null}
    </HudContext.Provider>
  );
}

function Hud({
  message,
  action,
  leaving,
  onClose,
}: {
  message: string;
  action?: HudAction;
  leaving: boolean;
  onClose: () => void;
}) {
  return (
    <div
      role="alert"
      className={`hud fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border border-hud/15 bg-white py-2.5 pr-3 pl-3.5 text-label font-medium text-hud shadow-[0_8px_24px_-6px_rgba(0,0,0,0.14)] ${
        leaving ? "hud-leaving pointer-events-none" : ""
      }`}
    >
      <IconAlertCircleFilled size={18} className="size-[1.125rem] shrink-0" />
      <span>{message}</span>
      {action ? (
        <>
          <span aria-hidden className="h-4 w-px shrink-0 bg-hud/25" />
          <button
            type="button"
            onClick={() => {
              onClose();
              action.run();
            }}
            className="shrink-0 cursor-pointer font-semibold whitespace-nowrap hover:underline"
          >
            {action.label}
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-hud/70 hover:bg-hud/10 hover:text-hud"
      >
        <IconX size={16} className="size-4" stroke={2} />
      </button>
    </div>
  );
}
