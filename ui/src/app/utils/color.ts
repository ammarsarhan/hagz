export default function getRandomColor() {
    const colors = [
        "bg-orange-700", "bg-blue-700", "bg-green-700",
        "bg-purple-700", "bg-pink-700", "bg-teal-700",
        "bg-amber-700", "bg-indigo-700", "bg-rose-700"
    ];

    const random = colors[Math.floor(Math.random() * colors.length)];
    return random;
};

export function getAvatarColor(name: string) {
    const colors = [
        "bg-orange-700",
        "bg-blue-700",
        "bg-green-700",
        "bg-purple-700",
        "bg-pink-700",
        "bg-teal-700",
        "bg-amber-700",
        "bg-indigo-700",
        "bg-rose-700"
    ];

    // Stable hash function based on character codes
    const hash = Array.from(name)
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // Always pick same color for same name
    return colors[hash % colors.length];
};