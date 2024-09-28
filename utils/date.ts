const date = new Date();

export default function getDate() {
    return date.toLocaleDateString();
}

export function getDayName() {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}