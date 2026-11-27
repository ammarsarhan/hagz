import { TimePick } from "@/components/time-pick";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// A new booking (Figma D10 612:26): the time first, then its price, who it's for, and a last look.
function NewBooking() {
  return <TimePick mode="book" />;
}

export default guarded(RULES.book, NewBooking);
