export default function parseGoogleMapsLink(url: string) {
    const patterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
            return { 
                type: 'coordinates' as const, 
                latitude: parseFloat(match[1]), 
                longitude: parseFloat(match[2]) 
            };
        }
    }

    const address = url.match(/[?&]q=([^&]+)/);
    if (address && address[1]) {
        return { 
            type: 'address' as const, 
            query: decodeURIComponent(address[1].replace(/\+/g, '%20')) 
        };
    }

    return null;
}