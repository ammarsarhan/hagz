// The drawings the venue-creation flow puts on top of a map and on the draft card, exported from the
// approved Figma frames (file Yvfn2eA7Z2yGb6IbL8P1ZB) as SVG for react-native-svg.

// The pin that sits in the middle of the map while the owner moves it under their entrance. Drawn
// after Google Maps' own pin so it reads as "this spot" at a glance: a plain teardrop in the brand
// blue with a darker dot, no outline. 28 × 40, point at the bottom.
export const MAP_PIN_SIZE = { width: 28, height: 40 } as const;

export const MAP_PIN =
  '<svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 1C6.82 1 1 6.82 1 14C1 23.75 14 39 14 39C14 39 27 23.75 27 14C27 6.82 21.18 1 14 1Z" fill="#1F38ED"/><circle cx="14" cy="14" r="4.75" fill="#142399"/></svg>';

// The corner the draft card is cut with, on its own black ("First run · draft card · Black,
// progress as top border", 302:6). 160 × 132, anchored to the card's top end corner.
export const DRAFT_CARD_ART_SIZE = { width: 160, height: 132 } as const;

export const DRAFT_CARD_ART =
  '<svg width="160" height="132" viewBox="0 0 160 132" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="Icon" clip-path="url(#clip0_0_4)"><path id="Vector" d="M44 0H160V100C136 122 104 118 84 98C64 78 46 84 31 62C16 40 26 13 44 0Z" fill="#1F2024"/><path id="Vector_2" d="M112 34.5C113.71 42.29 113.71 42.29 121.5 44C113.71 45.71 113.71 45.71 112 53.5C110.29 45.71 110.29 45.71 102.5 44C110.29 42.29 110.29 42.29 112 34.5Z" fill="white"/><path id="Vector_3" d="M134 73.2C134.864 77.136 134.864 77.136 138.8 78C134.864 78.864 134.864 78.864 134 82.8C133.136 78.864 133.136 78.864 129.2 78C133.136 77.136 133.136 77.136 134 73.2Z" fill="white"/></g><defs><clipPath id="clip0_0_4"><rect width="160" height="132" fill="white"/></clipPath></defs></svg>';
