export function toUTCDate (date: string, time: string) {
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
};

export function getDay(date: Date) {
    return date.toISOString().split("T")[0];
}

export function convertHourFormat(time: string) {
    let hours = Number(time.split(':')[0]);
    const minutes = Number(time.split(':')[1]);
    
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function getHourDifference(start: Date, end: Date) {
    return Math.abs(end.getTime() - start.getTime()) / 36e5;
}

export function isWithinRange(startTime: string, endTime: string, openingTime: string, closingTime: string) {
    return startTime >= openingTime && endTime <= closingTime
}

export function getDaysFromMonthIndex(index: number, year: number) {
    const days = new Date(year, index + 1, 0).getUTCDate();
    return days + 1;
}