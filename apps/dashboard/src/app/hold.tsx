import { TimePick } from "@/components/time-pick";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// Hold a time (Figma D9): the picker, then who it's for.
function HoldTime() {
  return <TimePick mode="hold" />;
}

export default guarded(RULES.book, HoldTime);
