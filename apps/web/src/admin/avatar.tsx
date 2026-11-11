// An admin's initials in a black circle, standing in for a photo (admins have none): the rail's
// account button and the Account page's header.

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const sizes = {
  small: "size-8 text-[0.75rem]",
  large: "size-[4.5rem] text-[1.5rem]",
} as const;

export function Avatar({ name, size = "small" }: { name: string; size?: keyof typeof sizes }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-white ${sizes[size]}`}
    >
      {initials(name)}
    </span>
  );
}
