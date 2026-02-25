export type TimeRange = [number, number];

export const hours = Array.from({ length: 25 }, (_, i) => {
    const hour = i % 12 === 0 ? 12 : i % 12;
    const period = i < 12 || i === 24 ? "AM" : "PM";

    return {
        value: String(i),
        label: `${hour}:00 ${period}`,
    };
});

export const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function rangesToBitmask(ranges: TimeRange[]): number {
    let mask = 0;

    for (const [start, end] of ranges) {
        for (let h = start; h < end; h++) {
            mask |= 1 << h;
        }
    };

    return mask;
};

export function bitmaskToRanges(mask: number): TimeRange[] {
    const ranges: TimeRange[] = [];
    let i = 0;

    while (i < 24) {
        if ((mask >> i) & 1) {
            const start = i;
            while (i < 24 && ((mask >> i) & 1)) i++;
            ranges.push([start, i]);
        } else {
            i++;
        }
    }

    return ranges;
};

export function flattenRanges(ranges: TimeRange[]): number[] {
    const hours = ranges.map(range => {
        const subhours = [];

        const start = range[0];
        const end = range[1];

        for (let i = start; i <= end - 1; i++) {
            subhours.push(i);
        };

        return subhours;
    });

    return hours.flat();
};
