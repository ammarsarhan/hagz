export function getTimeDifference(start: Date, end: Date) {
    const difference = end.getTime() - start.getTime();
    return difference / 1000 / 60 / 60;
}