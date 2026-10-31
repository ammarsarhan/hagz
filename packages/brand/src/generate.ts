// Writes every app icon and favicon from the mark (mark.ts). Run after changing the mark:
//   pnpm --filter @hagz/brand generate
// The outputs are committed, so the apps never need this package at build time.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { COLORS, FRAMINGS, type MarkOptions, markSvg } from "./mark";

const ROOT = join(import.meta.dirname, "../../..");

const png = (options: MarkOptions, px: number): Promise<Buffer> => {
  const image = sharp(Buffer.from(markSvg({ ...options, px })));
  // iOS rejects icons with an alpha channel, so full-bleed tiles are flattened. Rounded tiles keep
  // their transparent corners.
  const fullBleed = options.background && !options.radius;
  return (fullBleed ? image.flatten({ background: options.background }) : image).png().toBuffer();
};

// An .ico holding PNG images (supported by every current browser).
const ico = (images: { px: number; data: Buffer }[]): Buffer => {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ px, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(px >= 256 ? 0 : px, entry); // width (0 means 256)
    header.writeUInt8(px >= 256 ? 0 : px, entry + 1); // height
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
};

const write = async (path: string, data: Buffer | string) => {
  const file = join(ROOT, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);
  console.log(`wrote ${path}`);
};

// Expo app: a 1024 opaque iOS icon (iOS rounds the corners), and an Android adaptive icon (transparent
// foreground and a monochrome layer for themed icons, on a solid background colour set in app.config.ts).
const expoApp = async (app: string, color: string, background: string) => {
  await write(
    `apps/${app}/assets/icon.png`,
    await png({ framing: FRAMINGS.tile, color, background }, 1024),
  );
  await write(
    `apps/${app}/assets/adaptive-icon.png`,
    await png({ framing: FRAMINGS.androidForeground, color }, 1024),
  );
  await write(
    `apps/${app}/assets/adaptive-icon-monochrome.png`,
    await png({ framing: FRAMINGS.androidForeground, color: COLORS.white }, 1024),
  );
};

// Customer app: lime and black. Staff app: white and electric blue.
await expoApp("customer", COLORS.black, COLORS.lime);
await expoApp("dashboard", COLORS.blue, COLORS.white);

// Public web (customer facing): the lime tile. Browsers show favicons as-is, so the tile is rounded
// here. Browsers draw favicons at tab size, so 16 and 32 px use the small optical size; 48 px keeps
// full detail. Next.js links app/favicon.ico on every page, including admin's, so the .ico lives in
// public/ (still served at /favicon.ico for tools that ask for it) and each section links its own
// icon.svg with an icon.png fallback for browsers without SVG favicons.
const webTile = {
  framing: FRAMINGS.favicon,
  color: COLORS.black,
  background: COLORS.lime,
  radius: 0.22,
};
await write(
  "apps/web/public/favicon.ico",
  ico(
    await Promise.all(
      [16, 32, 48].map(async (px) => ({
        px,
        data: await png({ ...webTile, detail: px <= 32 ? "small" : "full" }, px),
      })),
    ),
  ),
);
await write("apps/web/src/app/icon.svg", markSvg({ ...webTile, detail: "small" }));
await write("apps/web/src/app/icon.png", await png({ ...webTile, detail: "small" }, 32));
// Apple touch icon: full bleed, because iOS rounds it.
await write(
  "apps/web/src/app/apple-icon.png",
  await png({ framing: FRAMINGS.tile, color: COLORS.black, background: COLORS.lime }, 180),
);

// Admin web: the mono mark, black in light browser tabs and white in dark ones.
await write(
  "apps/web/src/app/admin/icon.svg",
  markSvg({
    framing: FRAMINGS.bare,
    color: COLORS.black,
    detail: "small",
    style: "@media (prefers-color-scheme: dark) { .mark { color: #FFFFFF } }",
  }),
);
// PNG fallback can't follow the colour scheme, so it's the black mark on a white tile.
await write(
  "apps/web/src/app/admin/icon.png",
  await png(
    {
      framing: FRAMINGS.favicon,
      color: COLORS.black,
      background: COLORS.white,
      radius: 0.22,
      detail: "small",
    },
    32,
  ),
);
await write(
  "apps/web/src/app/admin/apple-icon.png",
  await png({ framing: FRAMINGS.tile, color: COLORS.black, background: COLORS.white }, 180),
);
