export function extractCoordinates(link: string) : { longitude: string, latitude: string } | null {
    if (!link || link.trim() === "") return null;

    let normalized = link.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;
    if (!/^https?:\/\/(www\.)?/i.test(normalized)) {
        normalized = normalized.replace(/^https?:\/\//i, "https://www.");
    }

    const isGoogleMaps = /https:\/\/(www\.)?google\.[a-z.]+\/maps\//i.test(normalized);
    const isShortLink = /https:\/\/(goo\.gl|maps\.app\.goo\.gl)\//i.test(normalized);

    // Don't extract from invalid or short links
    if (!isGoogleMaps || isShortLink) return null;

    const patterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,        // .../@30.0444,31.2357,17z
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,    // ...!3d30.0444!4d31.2357
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,   // ...?q=30.0444,31.2357
        /%40(-?\d+\.\d+),(-?\d+\.\d+)/,      // encoded @ e.g. %4030.0444,31.2357
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);

        if (match) {
            return {
                longitude: match[1],
                latitude: match[2]
            };
        }
    }

    return null;
}