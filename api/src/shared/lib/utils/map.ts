export default function getGridSize(zoom: number) {
    if (zoom <= 10) return 0.1;   // City-wide clusters.
    if (zoom <= 12) return 0.05;  // District clusters.
    if (zoom <= 14) return 0.01;  // Neighbourhood clusters.
    return 0;                     // Zoom 15+ returns individual pitches, no clustering.
};
