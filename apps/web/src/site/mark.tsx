import { FLAME, PENTAGON, RING, RING_WIDTH, SEAMS, SEAM_WIDTH } from "@hagz/brand/mark";

// The Hagz mark at full detail, no tile, in the current text colour: the same paths as every icon
// and favicon (@hagz/brand), so it never drifts from them. Framed on its tight bounds.
export function Mark({ className, label = "Hagz" }: { className?: string; label?: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0.35 0.28 31.75 27.37"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={FLAME} fill="currentColor" stroke="none" />
      <path d={RING} strokeWidth={RING_WIDTH} />
      <path d={PENTAGON} strokeWidth={SEAM_WIDTH} />
      <path d={SEAMS} strokeWidth={SEAM_WIDTH} />
    </svg>
  );
}
