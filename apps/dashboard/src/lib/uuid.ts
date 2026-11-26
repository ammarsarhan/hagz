// A random UUID (v4), for idempotency keys: one per user action, reused on its retries. Hermes has
// no crypto.randomUUID, and a key only has to be unique, not secret, so Math.random will do.
export const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
