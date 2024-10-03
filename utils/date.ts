export const today = new Date();

const addDays = function (date: Date, days: number) {
    var result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

export default function getDate() {
    return today.toLocaleDateString();
}

export function getMonth() {
    return today.toLocaleDateString("en-US", { month: 'long' });
}

export function getYear() {
    return today.toLocaleDateString("en-US", { year: 'numeric' });
}

export function getNextWeekDays() {
    let days = [today];
    for (let i = 1; i <= 6; i++) {
        days.push(addDays(today, i));
    }

    return days;
}

export function getDayName() {
    return today.toLocaleDateString('en-US', { weekday: 'short' });
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