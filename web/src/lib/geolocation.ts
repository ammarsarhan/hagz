export type GeolocationResult =
    | { success: true; latitude: number; longitude: number } 
    | { success: false; error: string };

export async function getDeviceCoordinates(): Promise<GeolocationResult> {
    if (!navigator.geolocation) {
        return { success: false, error: "Geolocation is not supported by your browser." };
    };

    try {
        const permission = await navigator.permissions.query({ name: "geolocation" });

        if (permission.state === "denied") {
            return { success: false, error: "Location access is blocked. Please allow it in your browser settings." };
        };

        return await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    success: true,
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                }),
                (err) => resolve({
                    success: false,
                    error: err.message,
                }),
                { enableHighAccuracy: true, timeout: 8000 }
            );
        });
    } catch {
        return await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ success: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                (err) => resolve({ success: false, error: err.message })
            );
        });
    };
};
