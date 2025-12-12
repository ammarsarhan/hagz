import { addHours, addMinutes, isSameDay, set } from "date-fns";

export function formatDate(val: string) {
    const date = new Date(val);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return {
        time: `${hh}:${min}`,
        date: `${dd}/${mm}/${yyyy}`
    };
}

export function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");

    return `${m}:${s}`;
};

export function formatHour(value: number, includeMeridiem: boolean = false): string {
  const normalized = value === 24 ? 0 : value;

  if (!includeMeridiem) {
    const hour = normalized.toString().padStart(2, "0");
    return `${hour}:00`;
  }

  const meridiem = normalized >= 12 ? "PM" : "AM";
  const extended = normalized % 12 === 0 ? 12 : normalized % 12;

  return `${extended}:00 ${meridiem}`;
};

export function getMeridiem(value: number) {
    if (value > 12) {
        return "PM";
    }

    return "AM";
};

export const getRoundedHour = (date: Date) => {
    const roundedDate = date.getMinutes() > 0 
        ? addHours(set(date, { minutes: 0, seconds: 0, milliseconds: 0 }), 1)
        : set(date, { minutes: 0, seconds: 0, milliseconds: 0 });
    
    const hours = roundedDate.getHours();
    
    if (hours === 0 && !isSameDay(date, roundedDate)) {
        return 24;
    }
    
    return hours;
};