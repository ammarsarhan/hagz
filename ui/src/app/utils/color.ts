export default function getRandomColor() {
    const colors = [
        "bg-orange-700", "bg-blue-700", "bg-green-700",
        "bg-purple-700", "bg-pink-700", "bg-teal-700",
        "bg-amber-700", "bg-indigo-700", "bg-rose-700"
    ];

    const random = colors[Math.floor(Math.random() * colors.length)];
    return random;
};

export function getChartColor(index: number) {
    const colors = [
        "hsl(24, 83%, 44%)",   // orange-700
        "hsl(217, 91%, 44%)",  // blue-700
        "hsl(142, 71%, 35%)",  // green-700
        "hsl(263, 70%, 48%)",  // purple-700
        "hsl(330, 81%, 52%)",  // pink-700
        "hsl(173, 80%, 36%)",  // teal-700
        "hsl(38, 92%, 50%)",   // amber-700
        "hsl(239, 84%, 48%)",  // indigo-700
        "hsl(350, 89%, 48%)"   // rose-700
    ];

    return colors[index % colors.length];
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