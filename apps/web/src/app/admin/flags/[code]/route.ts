import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Round country flags from the circle-flags package, one SVG per ISO 3166-1 alpha-2 code
// (/admin/flags/eg). The package is only a folder of SVGs, so this serves the one asked for. Every
// country is written out at build time, and any other code is a 404.

// node_modules is hoisted to the repo root (.npmrc), so look up from wherever this runs.
const flagsDirectory = () => {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", "circle-flags", "flags");
    if (existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) throw new Error("circle-flags isn't installed.");
  }
};

const country = /^[a-z]{2}$/;

export const dynamicParams = false;

export async function generateStaticParams() {
  const files = await readdir(flagsDirectory());
  return files
    .map((file) => file.replace(/\.svg$/, ""))
    .filter((code) => country.test(code))
    .map((code) => ({ code }));
}

export async function GET(_request: Request, { params }: RouteContext<"/admin/flags/[code]">) {
  const { code } = await params;
  if (!country.test(code)) return new Response(null, { status: 404 });
  const svg = await readFile(path.join(flagsDirectory(), `${code}.svg`));
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // An image, never a document: opened directly, nothing in it may run or load.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
