// A fresh Idempotency-Key for an action that creates something (POST /v1/bookings): a v4 UUID,
// reused on every retry of the same action. Math.random is enough here: the key only has to be
// unique to this player's own retries, and it keeps a native crypto module (and a new dev build) out.
export const newIdempotencyKey = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random % 4) + 8).toString(16);
  });
