import { useId, type InputHTMLAttributes, type ReactNode } from "react";

// The box every input sits in, as in the apps: white, 56 high, 1px light border, 14 corners; 1.5px
// black when focused, red with an error. Padding shrinks by the extra half pixel so text doesn't move.
export const boxClass = (error: boolean) =>
  `flex h-14 items-center gap-2.5 rounded-field border bg-white px-4 transition-colors ${
    error
      ? "border-[1.5px] border-red px-[15.5px]"
      : "border-border focus-within:border-[1.5px] focus-within:border-primary focus-within:px-[15.5px]"
  } has-[input:disabled]:border-field has-[input:disabled]:bg-field`;

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
}

// A labelled input. Errors are the person's to fix, so they sit right under the field.
export function Field({ label, error, hint, trailing, ...input }: FieldProps) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-medium text-ink-2">
        {label}
      </label>
      <div className={boxClass(Boolean(error))}>
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={note ? `${id}-note` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[17px] leading-[22px] text-ink outline-none placeholder:text-ink-3 disabled:text-ink-2"
          {...input}
        />
        {trailing}
      </div>
      {note ? (
        <p
          id={`${id}-note`}
          className={`text-caption ${error ? "font-medium text-red" : "text-ink-2"}`}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
