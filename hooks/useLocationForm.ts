import { useState } from 'react';
import AppLocation from '@/utils/types/location';

export default function useLocationForm() {
    const [longitude, setLongtitude] = useState("");
    const [latitude, setLatitude] = useState("");
    const [building, setBuilding] = useState("");
    const [street, setStreet] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [governorate, setGovernorate] = useState("");
    const [googleMapsLink, setGoogleMapsLink] = useState("");

    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);

    type Validity = {
        result: boolean,
        message: string
    }

    const isValid = (): Validity => {
        if (longitude != "" && isNaN(lng) || latitude != "" && isNaN(lat)) {
            return {
                result: false,
                message: "Please enter a valid number."
            }
        }

        if (!isNaN(lng) && lng >= 180 || lng <= -180) {
            return {
                result: false,
                message: "Longitude should be between -180 and 180."
            };
        }

        if (!isNaN(lat) && lat >= 90 || lat <= -90) {
            return {
                result: false,
                message: "Latitude should be between -90 and 90."
            };
        }

        if (googleMapsLink != "") {
            const pattern = /^(https?:\/\/)?(www\.)?google\.com\/maps\/|^(https?:\/\/)?(www\.)?goo\.gl\/|^(https?:\/\/)?(maps\.google\.com\/)/;
            const test = pattern.test(googleMapsLink);
            return {
                result: test,
                message: "Enter a valid Google Maps link."
            }
        }

        if (street != "" && address != "" && governorate != "" || googleMapsLink != "") {
            return {
                result: true,
                message: ""
            };
        } else {
            return {
                result: false,
                message: "Please fill in all the required fields."
            };
        };
    }

    const getFields = (): AppLocation => {
        return {
            longitude: isNaN(lng) ? 0 : parseFloat(longitude),
            latitude: isNaN(lat) ? 0 : parseFloat(latitude),
            building: building,
            street: street,
            address: address,
            city: city,
            governorate: governorate,
            googleMapsLink: googleMapsLink
        }
    }

    return {
        longitude,
        setLongtitude,
        latitude,
        setLatitude,
        building,
        setBuilding,
        street,
        setStreet,
        address,
        setAddress,
        city,
        setCity,
        governorate,
        setGovernorate,
        googleMapsLink,
        setGoogleMapsLink,
        getFields,
        isValid
    }
}