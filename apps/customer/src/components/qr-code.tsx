import { create } from "qrcode";
import { useMemo } from "react";
import Svg, { Path } from "react-native-svg";

// A QR code drawn as one path, each row's runs of dark modules one rectangle (no seams between
// neighbours once scaled), at `size`. Low error correction: a phone screen is a clean image, and
// fewer, bigger modules scan more easily (57 rather than 65 across for a check-in code). No quiet
// zone of its own; the card around it gives the white margin scanners need.
export function QrCode({ value, size }: { value: string; size: number }) {
  const { path, count } = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: "L" });
    const n = modules.size;
    let d = "";
    for (let row = 0; row < n; row++) {
      let col = 0;
      while (col < n) {
        if (!modules.get(row, col)) {
          col++;
          continue;
        }
        const start = col;
        while (col < n && modules.get(row, col)) col++;
        d += `M${start} ${row}h${col - start}v1h${start - col}z`;
      }
    }
    return { path: d, count: n };
  }, [value]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
      <Path d={path} fill="#000000" />
    </Svg>
  );
}
