import type { ReactNode } from "react";
import { Text } from "./text";

// The heading over a group within a screen ("Required", "Sport", "Bookings", "Security"): 18 Semi
// Bold, clearly under the page's 28 title and above its 16 rows (user, 2026-11-15: one size for
// every group heading in the app). The space around it is the screen's to set.
export function GroupHeading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Text
      accessibilityRole="header"
      className={`text-[18px] font-semibold leading-[1.33] ${className}`}
    >
      {children}
    </Text>
  );
}
