import type { ButtonHTMLAttributes } from "react";

// The pill from the apps, a step smaller for desktop: 48 high (the apps use 56), fully round, 16/600
// label, matching the fields. Black here, where the staff app is blue.
const variants = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-chip text-ink",
  ghost: "bg-transparent text-ink",
  // Deleting something.
  danger: "bg-red text-white",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  // Waiting on the server: a spinner replaces the label and the button can't be pressed again.
  loading?: boolean;
  // Small sits in a page header or a table's toolbar: 40 high, as wide as its label.
  size?: keyof typeof sizes;
}

const sizes = {
  regular: "h-12 w-full px-6 text-[1rem] leading-[1.3125rem]",
  // The regular pill a step down for a modal's footer: 44 high, the same 16/600 label.
  medium: "h-11 gap-1.5 px-7 text-[1rem] leading-[1.3125rem]",
  small: "h-10 gap-1.5 px-5 text-label",
} as const;

export function Button({
  variant = "primary",
  loading = false,
  size = "regular",
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const look = disabled && !loading ? "bg-field text-ink-3" : variants[variant];
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full font-semibold ${sizes[size]} transition-opacity hover:opacity-90 disabled:cursor-default disabled:hover:opacity-100 ${look}`}
      {...rest}
    >
      {loading ? (
        <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        children
      )}
    </button>
  );
}
