import { TimePick } from "@/components/time-pick";

// A new booking (Figma D10 612:26): the time first, then its price, who it's for, and a last look.
export default function NewBooking() {
  return <TimePick mode="book" />;
}
