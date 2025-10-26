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

export function formatHour(value: number): string {
  // if it's the last hour (24), return "23:59"
  if (value === 24) return "23:59";

  // pad hour with leading zero if needed
  const hour = value.toString().padStart(2, "0");
  return `${hour}:00`;
}