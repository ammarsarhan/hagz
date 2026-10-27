import type { Tx } from "@/platform/db/transaction";

// A customer signed up with a proven phone: the walk-in records venues kept under that number become
// their history.
export const linkWalkIns = (tx: Tx, phone: string, customerId: string) =>
  tx.venueCustomer.updateMany({ where: { phone, customerId: null }, data: { customerId } });
