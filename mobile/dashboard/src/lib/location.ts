export default function parseGoogleMapsLink(url: string) {
    const patterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return { 
                type: 'coordinates', 
                latitude: parseFloat(match[1]), 
                longitude: parseFloat(match[2]) 
            };
        }
    }

    const address = url.match(/[?&]q=([^&]+)/);
    if (address) {
        return { 
            type: 'address', 
            query: decodeURIComponent(address[1].replace(/\+/g, '%20')) 
        };
    }

    return null;
}