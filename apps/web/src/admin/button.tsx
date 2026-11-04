import type { ButtonHTMLAttributes } from "react";

// The pill from the apps, a step smaller for desktop: 48 high (the apps use 56), fully round, 16/600
// label, matching the fields. Black here, where the staff app is blue.
const variants = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-chip text-ink",
  ghost: "bg-transparent text-ink",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  // Waiting on the server: a spinner replaces the label and the button can't be pressed again.
  loading?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
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
      className={`flex h-12 w-full cursor-pointer items-center justify-center rounded-full px-6 text-[16px] leading-[21px] font-semibold transition-opacity hover:opacity-90 disabled:cursor-default disabled:hover:opacity-100 ${look}`}
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
