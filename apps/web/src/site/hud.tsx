"use client";

import { IconAlertCircleFilled } from "@tabler/icons-react";
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

// The customer app's HUD on the web (its components/hud.tsx): a pale pill at the bottom centre with
// an icon and a short line, rising in, gone after 3 seconds. Above the phone's Book bar on a phone.

const VISIBLE_MS = 3000;
// How long .hud-leaving (site.css) takes to fade out before it's removed.
const FADE_MS = 200;

type Show = (message: string, options?: { leading?: ReactNode }) => void;

interface Showing {
  message: string;
  leading?: ReactNode;
  key: number;
  leaving?: boolean;
}

const HudContext = createContext<Show | null>(null);

export const useHud = () => {
  const show = useContext(HudContext);
  if (!show) throw new Error("useHud needs HudProvider");
  return show;
};

export function HudProvider({ children }: { children: ReactNode }) {
  const [showing, setShowing] = useState<Showing>();

  const show = useCallback<Show>((message, options) => {
    setShowing((was) => ({ message, leading: options?.leading, key: (was?.key ?? 0) + 1 }));
  }, []);

  // Each message restarts the clock: shown, then faded out, then removed.
  useEffect(() => {
    if (!showing) return;
    const timer = showing.leaving
      ? setTimeout(() => setShowing(undefined), FADE_MS)
      : setTimeout(() => setShowing((was) => was && { ...was, leaving: true }), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [showing]);

  const value = useMemo(() => show, [show]);
  return (
    <HudContext.Provider value={value}>
      {children}
      {showing
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-[104px] z-50 flex justify-center lg:bottom-8">
              <div
                key={showing.key}
                role="status"
                className={`flex h-14 items-center gap-2.5 rounded-hud border border-hairline bg-hud ps-[18px] pe-[22px] shadow-[0_6px_16px_rgba(11,11,12,0.08)] ${showing.leaving ? "hud-leaving" : "hud-entering"}`}
              >
                {showing.leading ?? <IconAlertCircleFilled size={22} />}
                <span className="text-subtitle font-medium">{showing.message}</span>
              </div>
            </div>,
            document.body,
          )
        : null}
    </HudContext.Provider>
  );
}
