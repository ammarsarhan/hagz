import type { Tx } from "@/platform/db/transaction";

// A customer signed up with a proven phone: the walk-in records venues kept under that number become
// their history.
export const linkWalkIns = (tx: Tx, phone: string, customerId: string) =>
  tx.venueCustomer.updateMany({ where: { phone, customerId: null }, data: { customerId } });

// The venue's record of a player booking in the app, made on their first booking there. A walk-in
// record already under their number becomes theirs. Safe when the same player books twice at once:
// inserts skip conflicts and the row is read back.
export const venueCustomerForAccount = async (
  tx: Tx,
  venueId: string,
  account: { id: string; name: string; phone: string },
): Promise<string> => {
  const find = () =>
    tx.venueCustomer.findUnique({
      where: { venueId_customerId: { venueId, customerId: account.id } },
      select: { id: true },
    });

  const linked = await find();
  if (linked) return linked.id;

  const [walkIn] = await tx.venueCustomer.updateManyAndReturn({
    where: { venueId, phone: account.phone, customerId: null },
    data: { customerId: account.id },
    select: { id: true },
  });
  if (walkIn) return walkIn.id;

  const insert = (phone: string | null) =>
    tx.venueCustomer.createMany({
      data: [{ venueId, customerId: account.id, name: account.name, phone }],
      skipDuplicates: true,
    });
  await insert(account.phone);
  const created = await find();
  if (created) return created.id;

  // The number is on another account's record here (a recycled number), so this one goes without.
  await insert(null);
  const withoutPhone = await find();
  if (!withoutPhone) throw new Error("Couldn't create the venue's customer record.");
  return withoutPhone.id;
};
