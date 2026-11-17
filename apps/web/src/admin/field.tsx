import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

// A field's label. `asterisk` marks one that has to be filled in; the input's `required` is what
// tells screen readers, so the mark itself is hidden from them.
function Label({ htmlFor, text, asterisk }: { htmlFor: string; text: string; asterisk: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-label font-medium text-ink-2">
      {text}
      {asterisk ? (
        <span aria-hidden className="ml-0.5 text-ink">
          *
        </span>
      ) : null}
    </label>
  );
}

// The box every input sits in: white, 48 high (the apps use 56; desktop forms are denser), 1px light
// border, 14 corners; 1.5px black when focused, red with an error. Padding shrinks by the extra half
// pixel so text doesn't move.
export const boxClass = (error: boolean) =>
  `flex h-12 items-center gap-2.5 rounded-field border bg-white px-4 transition-colors ${
    error
      ? "border-[1.5px] border-red px-[calc(1rem-0.5px)]"
      : "border-border focus-within:border-[1.5px] focus-within:border-primary focus-within:px-[calc(1rem-0.5px)]"
  } has-[input:disabled]:border-field has-[input:disabled]:bg-field`;

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
  // Marks the label of a field that has to be filled in.
  asterisk?: boolean;
}

// A labelled input. Errors are the person's to fix, so they sit right under the field.
export function Field({
  label,
  error,
  hint,
  trailing,
  asterisk = false,
  ...input
}: FieldProps) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} text={label} asterisk={asterisk} />
      <div className={boxClass(Boolean(error))}>
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={note ? `${id}-note` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[1rem] leading-[1.3125rem] text-ink outline-none placeholder:text-ink-3 disabled:text-ink-2"
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

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  // Shown, greyed out, until something is picked (the value is "" until then).
  placeholder?: string;
}

// A labelled native select in the same box as Field.
export function SelectField({ label, hint, options, placeholder, ...select }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-medium text-ink-2">
        {label}
      </label>
      <div className={boxClass(false)}>
        <select
          id={id}
          aria-describedby={hint ? `${id}-note` : undefined}
          className={`h-full min-w-0 flex-1 cursor-pointer bg-transparent text-[1rem] leading-[1.3125rem] outline-none ${
            placeholder && !select.value ? "text-ink-3" : "text-ink"
          }`}
          {...select}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {hint ? (
        <p id={`${id}-note`} className="text-caption text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  // Marks the label of a field that has to be filled in.
  asterisk?: boolean;
}

// A labelled multi-line field in the same box as Field, for a sentence or two (a reason).
export function TextAreaField({ label, hint, asterisk = false, ...area }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} text={label} asterisk={asterisk} />
      <textarea
        id={id}
        rows={4}
        aria-describedby={hint ? `${id}-note` : undefined}
        className="resize-none rounded-field border border-border bg-white px-4 py-3 text-[1rem] leading-[1.375rem] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-[1.5px] focus:border-primary focus:px-[calc(1rem-0.5px)] focus:py-[calc(0.75rem-0.5px)]"
        {...area}
      />
      {hint ? (
        <p id={`${id}-note`} className="text-caption text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
