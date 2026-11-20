// What the app draws on its maps, as SVG for react-native-svg.

// A venue's pin: the staff app's teardrop (assets/map-art.ts there, blue with a darker blue dot) in
// the customer's lime with a darker lime dot (user, 2026-11-20), and a hairline of the dark lime so
// the light lime holds its shape on a pale map. 28 × 40, point at the bottom.
export const MAP_PIN_SIZE = { width: 28, height: 40 } as const;

export const MAP_PIN =
  '<svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 1C6.82 1 1 6.82 1 14C1 23.75 14 39 14 39C14 39 27 23.75 27 14C27 6.82 21.18 1 14 1Z" fill="#E9FEA0" stroke="#8FA83A" stroke-width="1"/><circle cx="14" cy="14" r="4.75" fill="#8FA83A"/></svg>';
