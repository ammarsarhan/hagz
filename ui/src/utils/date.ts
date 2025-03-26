export function toUTCDate (date: string, time: string) {
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
};

export function getDay(date: Date) {
    return date.toISOString().split("T")[0];
}

export function getHourDifference (start: Date, end: Date) {
    return Math.abs(end.getTime() - start.getTime()) / 36e5;
}