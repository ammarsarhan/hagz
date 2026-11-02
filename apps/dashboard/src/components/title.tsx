import { Text } from "./text";

// The big start-aligned title (28/34, 600) and its one-line grey subtitle.
export function Title({ children, subtitle }: { children: string; subtitle?: string }) {
  return (
    <>
      <Text accessibilityRole="header" className="mb-2 text-title font-semibold tracking-[-0.4px]">
        {children}
      </Text>
      {subtitle ? <Text className="mb-7 text-subtitle text-ink-2">{subtitle}</Text> : null}
    </>
  );
}
