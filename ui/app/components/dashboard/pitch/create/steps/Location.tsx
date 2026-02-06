import { motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import { DropdownGroup } from "@/app/components/dashboard/Dropdown";
import { InputGroup } from "@/app/components/dashboard/Input";
import { CountryEnum, CreatePitchFormType } from "@/app/utils/types/dashboard";
import { useEffect } from "react";
import { extractCoordinates } from "@/app/utils/dashboard/map";

const countryOptions = [
    { label: "Egypt", value: "EG", language: "English & Arabic", currency: "EGP" }, 
    { label: "Saudi Arabia", value: "SA", language: "English & Arabic", currency: "SAR" }, 
    { label: "United Arab Emirates", value: "AE", language: "English & Arabic", currency: "AED" }
];

export default function Location() {
    const { data, setData, errors } = useFormContext<CreatePitchFormType>();

    useEffect(() => {
        const coordinates = extractCoordinates(data.googleMapsLink);

        if (coordinates) {
            const { longitude, latitude } = coordinates;

            setData(prev => ({
                ...prev,
                longitude,
                latitude
            }));
        } else if (data.googleMapsLink.trim() === "") {
            setData(prev => ({
                ...prev,
                latitude: "N/A",
                longitude: "N/A"
            }));
        };
    }, [data.googleMapsLink, setData]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-[calc(100vh-2rem)] flex-center flex-col gap-y-7 w-3xl"
        >   
            <div className="flex flex-col gap-y-3 w-full">
                <div className="flex gap-x-4 w-full">
                    <InputGroup label={"Street"} onChange={(e) => setData(prev => ({ ...prev, street: e.target.value }))} type={"text"} placeholder={"Street"} value={data.street} className="flex-1"/>
                    <InputGroup label={"Area"} onChange={(e) => setData(prev => ({ ...prev, area: e.target.value }))} type={"text"} placeholder={"Area"} value={data.area} className="flex-1"/>
                </div>
                <div className="flex gap-x-4 w-full">
                    <InputGroup label={"City"} onChange={(e) => setData(prev => ({ ...prev, city: e.target.value }))} type={"text"} placeholder={"City"} value={data.city} className="flex-1"/>
                    <DropdownGroup onChange={(value) => setData(prev => ({ ...prev, country: value as CountryEnum }))} placeholder={"Select country"} value={data.country} options={countryOptions} label={"Country"} className="flex-1"/>
                </div>
            </div>
            <div className="flex gap-x-4 w-full">
                <InputGroup label={"Language"} type={"text"} placeholder={"Language"} value={countryOptions.find(option => option.value === data.country)!.language} readOnly className="flex-1"/>
                <InputGroup label={"Currency"} type={"text"} placeholder={"Currency"} value={countryOptions.find(option => option.value === data.country)!.currency} readOnly className="flex-1"/>
            </div>
            <div className="flex flex-col gap-y-3.5 w-full">
                <div className="w-full">
                    <InputGroup error={errors["googleMapsLink"]} label={"Google Maps Link"} onChange={(e) => setData(prev => ({ ...prev, googleMapsLink: e.target.value }))} type={"text"} placeholder={"Link"} value={data.googleMapsLink} className="flex-1" description="Adding a Google Maps link helps us index your pitch better, making you appear higher in search results."/>
                </div>
                <div className="w-full flex flex-col gap-y-2">
                    <div className="flex flex-col gap-y-3">
                        <div className="flex gap-x-4 w-full">
                            <InputGroup label="Longitude" onChange={(e) => setData(prev => ({ ...prev, longitude: e.target.value }))} type={"text"} placeholder={"Longitude"} value={data.longitude} readOnly className="flex-1"/>
                            <InputGroup label="Latitude" onChange={(e) => setData(prev => ({ ...prev, latitude: e.target.value }))} type={"text"} placeholder={"Latitude"} value={data.latitude} readOnly className="flex-1"/>
                        </div>
                    </div>
                    <p className="text-xs text-gray-600">Hagz uses your Google Maps location to pinpoint your pitch&apos;s coordinates accurately and perform radius search.</p>
                </div>
            </div>
        </motion.div>
    )
}