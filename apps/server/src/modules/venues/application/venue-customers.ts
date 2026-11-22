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

// Someone staff are booking or holding for by name and number (a phone call, the front desk): the
// venue's record under that number if it has one, otherwise a new walk-in. Inserts skip a conflict
// with one made at the same moment and read it back.
export const walkInCustomer = async (
  tx: Tx,
  venueId: string,
  person: { name: string; phone: string },
): Promise<string> => {
  const find = () =>
    tx.venueCustomer.findUnique({
      where: { venueId_phone: { venueId, phone: person.phone } },
      select: { id: true },
    });
  const known = await find();
  if (known) return known.id;
  await tx.venueCustomer.createMany({
    data: [{ venueId, name: person.name, phone: person.phone }],
    skipDuplicates: true,
  });
  const created = await find();
  if (!created) throw new Error("Couldn't create the venue's customer record.");
  return created.id;
};
