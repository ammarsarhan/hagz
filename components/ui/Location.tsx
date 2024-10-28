import { MapPin, X } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button";
import useLocationForm from "@/hooks/useLocationForm";
import AppLocation from '@/utils/types/location'

interface LocationModalProps {
    active: boolean
    description: string,
    closeModal: () => void,
    addHandler: (fields: Partial<AppLocation>) => void
}

export function LocationModal ({active, description, closeModal, addHandler} : LocationModalProps) {
    const {
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
    } = useLocationForm();

    const [error, setError] = useState("");

    const handleError = (message: string) => {
        setError(message);
        setTimeout(() => {
            setError("");
        }, 5000);
    }

    if (active) {
        return (
            <div className="fixed flex-center w-full h-full top-0 left-0 bg-slate-900 bg-opacity-25">
                <div className="sm:w-full md:w-2/3 lg:w-1/2 my-4 px-8 pt-10 pb-5 rounded-md bg-white overflow-y-scroll h-full sm:h-auto">
                    <div className="flex items-start justify-between gap-x-4 pb-4 border-b-[1px]">
                        <div>
                            <h3 className="text-base font-medium mb-1">Add Location Details</h3>
                            <p className="text-dark-gray">{description}</p>
                        </div>
                        <button onClick={closeModal} type="button"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="flex flex-col gap-y-4 py-6 border-b-[1px]">
                        <span className="text-red-600">{error}</span>
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span>Longitude</span>
                                <input value={longitude || ""} onChange={(e) => setLongtitude(e.target.value)} type="text" placeholder="Longitude (Optional)" className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span>Latitude</span>
                                <input value={latitude || ""} onChange={(e) => setLatitude(e.target.value)} type="text" placeholder="Longitude (Optional)" className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                        </div>
                        <div className="flex flex-col gap-y-2">
                            <span>Building</span>
                            <input value={building || ""} onChange={(e) => setBuilding(e.target.value)} type="text" placeholder="Building Name (Optional)" className="py-2 px-3 border-[1px] rounded-lg"/>
                        </div>
                        <div className="flex flex-col gap-y-2">
                            <span>Street</span>
                            <input value={street || ""} onChange={(e) => setStreet(e.target.value)} type="text" placeholder="Street Name" className="py-2 px-3 border-[1px] rounded-lg"/>
                        </div>
                        <div className="flex flex-col gap-y-2">
                            <span>Address</span>
                            <input value={address || ""} onChange={(e) => setAddress(e.target.value)} type="text" placeholder="Address" className="py-2 px-3 border-[1px] rounded-lg"/>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span>City</span>
                                <input value={city || ""} onChange={(e) => setCity(e.target.value)} type="text" placeholder="City (Optional)" className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span>Governorate</span>
                                <input value={governorate || ""} onChange={(e) => setGovernorate(e.target.value)} type="text" placeholder="Governorate" className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-x-4 py-6 border-b-[1px]">
                        <span>Google Maps Link: </span>
                        <input value={googleMapsLink || ""} onChange={(e) => setGoogleMapsLink(e.target.value)} type="text" placeholder="Insert link (⌘+v)" className="py-2 px-3 border-[1px] rounded-lg flex-1"/>
                    </div>
                    <div className="flex items-center justify-end pt-4">
                        <Button variant="color" type="button" onClick={isValid().result ? () => addHandler({...getFields()}) : () => handleError(isValid().message)}>Add Location</Button>
                    </div>
                </div>
            </div>
        )
    }

    return <></>
}

export default function LocationTrigger ({onClick} : {onClick: () => void}) {
    return <Button onClick={onClick} type="button" variant="primary" className="flex items-center gap-x-2 text-[0.8125rem]"><MapPin className="w-4 h-4"/> Add Location</Button>
}