type TimeRange = { start: number; end: number };

export function timeRangesToBytes(ranges: TimeRange[]): Buffer<ArrayBuffer> {
    let mask = 0;
    for (const { start, end } of ranges) {
        for (let hour = start; hour < end; hour++) {
            mask |= (1 << hour);
        }
    }

    const buf = Buffer.allocUnsafe(3);
    buf.writeUIntBE(mask, 0, 3);
    return Buffer.from(buf) as Buffer<ArrayBuffer>;
}

export function bytesToTimeRanges(bytes: Uint8Array): TimeRange[] {
    const buf = Buffer.from(bytes);
    const mask = buf.readUIntBE(0, 3);
    const ranges: TimeRange[] = [];
    let i = 0;

    while (i < 24) {
        if (mask & (1 << i)) {
            const start = i;
            while (i < 24 && (mask & (1 << i))) i++;
            ranges.push({ start, end: i });
        } else {
            i++;
        }
    }

    return ranges;
}
