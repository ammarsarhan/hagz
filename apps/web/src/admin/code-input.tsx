"use client";

import { useEffect, useRef, useState } from "react";

const LENGTH = 6;

// Six boxes, as in the staff app: 60 high, 14 corners, 8 apart. One real input sits over them, so
// typing, pasting all six digits and the browser's one-time-code autofill all just work.
export function CodeInput({
  value,
  onChange,
  onComplete,
  error,
  disabled = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  // The sixth digit is in: send it without waiting for a button press.
  onComplete?: (code: string) => void;
  error?: string;
  disabled?: boolean;
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  // autoFocus can land before React is listening (the server's HTML focuses it on load), so the focus
  // event is missed; ask once mounted instead.
  useEffect(() => {
    if (document.activeElement === input.current) setFocused(true);
  }, []);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative" onClick={() => input.current?.focus()}>
        <input
          ref={input}
          aria-label={label}
          aria-invalid={Boolean(error)}
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={LENGTH}
          disabled={disabled}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, LENGTH);
            onChange(next);
            if (next.length === LENGTH) onComplete?.(next);
          }}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
        <div aria-hidden className="flex gap-2">
          {Array.from({ length: LENGTH }, (_, i) => {
            const active = focused && !disabled && i === Math.min(value.length, LENGTH - 1);
            const look = error
              ? "border-[1.5px] border-red"
              : active
                ? "border-[1.5px] border-primary"
                : "border border-border";
            return (
              <div
                key={i}
                className={`flex h-[3.75rem] flex-1 items-center justify-center rounded-field bg-white text-2xl font-semibold text-ink ${look}`}
              >
                {value[i] ?? ""}
              </div>
            );
          })}
        </div>
      </div>
      {error ? <p className="text-caption font-medium text-red">{error}</p> : null}
    </div>
  );
}
