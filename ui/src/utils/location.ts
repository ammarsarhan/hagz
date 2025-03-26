export function getClientLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            return resolve({ error: "Geolocation is not supported by this browser.", longitude: null, latitude: null });
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    longitude: position.coords.longitude,
                    latitude: position.coords.latitude,
                    error: null
                });
            },
            (error) => {
                let message: string;

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = "Can not set search radius without location permission.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = "Location information is unavailable.";
                        break;
                    case error.TIMEOUT:
                        message = "The request to get user location timed out.";
                        break;
                    default:
                        message = "An unknown error occurred.";
                        break;
                };

                resolve({ error: message, longitude: null, latitude: null });
            }
        );
    });
}
