// The few palette values that must be passed as props rather than classes (icon colors,
// placeholderTextColor). They mirror @hagz/brand/theme/tokens.css; change both together.
export const colors = {
  ink: "#0b0b0c",
  ink2: "#5e636b",
  ink3: "#9aa0a8",
  unit: "#737373",
  primary: "#1f38ed",
  // The draft card's progress edge (primary-soft = blue-mid).
  primarySoft: "#527cf7",
  onPrimary: "#ffffff",
  red: "#d92d20",
  green: "#067647",
  border: "#ebebeb",
  field: "#f4f5f7",
  // The layout grid's lines, drawn in SVG.
  grid: "#e6e8ec",
  // Animated backgrounds (a chosen option's tint, from white), which classes can't tween.
  white: "#ffffff",
  chip: "#f2f3f5",
  blueTint: "#eef1fe",
} as const;
