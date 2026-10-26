// Where "now" comes from. Code that needs the time takes a Clock instead of calling new Date(), so
// tests can pin it (hold expiry, minimum notice, OTP and token lifetimes, DST edges). Domain
// functions take `now` as an argument and never see a Clock.
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
