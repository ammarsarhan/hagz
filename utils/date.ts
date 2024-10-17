export const today = new Date();
export const hours = ["12:00 AM", "01:00 AM", "02:00 AM", "03:00 AM", "04:00 AM", "05:00 AM", "06:00 AM", "07:00 AM",  "08:00 AM",  "09:00 AM", "10:00 AM",  "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"];
export const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// 1, 2, 3, 4, 5, 6, 7

export const addDays = function (date: Date, days: number) {
    var result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

export default function getDate() {
    return today.toLocaleDateString();
}

export function getDayName(date: Date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function getMonth(date: Date) {
    return date.toLocaleDateString("en-US", { month: 'long' });
}

export function getYear(date: Date) {
    return date.toLocaleDateString("en-US", { year: 'numeric' });
}

export function getWeekdays(date: Date) {
    const current = date.getDay();
    
    let weekdays: {
        day: string,
        index: number
    }[] = [];

    // We want to create an array where the zero index is current.
    for (let i = 0; i <= 6; i++) {
        const index = i - current;
        const day = addDays(date, index).toLocaleDateString("en-us", {weekday: "short"});
        weekdays.push({day, index});
    }

    return weekdays;
}

export function getCalendar(date: Date) {
    let days = [];
    let temp = [];
    let dayCount: number = 1;

    const calendarStart = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const calendarEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() - 1;
    
    // We need to create 5 arrays, each of which are filled up with 7 numbers.
    // This will be done to map out each array to a table-row div and each of its successive numbers to a table-cell child

    // Temp will serve as our mold for each array to push, then will be cleared out for the subsequent 7 days.

    for (let i = 0; i <= 41; i++) {
        if (i < calendarStart || dayCount - 1 > calendarEnd) {
            temp.push(null);
        } else {
            temp.push(dayCount);
            dayCount++;
        }

        if ((i + 1) % 7 == 0) {
            // At every 7th day, push temp to days and clear it out.
            days.push(temp);
            temp = [];
        }
    }

    return days;
}

export function getNextWeekDays() {
    let days = [today];

    for (let i = 1; i <= 6; i++) {
        days.push(addDays(today, i));
    }

    return days;
}

export function getNextBillableWeek() {
    // Find a way to get the next 7th multiple of date
    for (let i = 1; i <= 8; i++) {
        let temp = addDays(today, i);

        if (temp.getDate() % 7 == 0) {
            return temp.toLocaleDateString('en-US');
        }
    }
}