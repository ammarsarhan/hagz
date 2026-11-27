import { Screen } from "@/components/screen";
import { guarded } from "@/components/guarded";
import { RULES } from "@/lib/access";

// Blank until this tab's screens are built.
function VenuePayments() {
  return <Screen tabbed>{null}</Screen>;
}

export default guarded(RULES.payments, VenuePayments, { tabbed: true });
