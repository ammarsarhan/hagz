import { useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

import Button from "@/components/ui/Button";
import AppLocation from '@/utils/types/location'

interface LocationModalProps {
    active: boolean
    description: string,
    source: AppLocation,
    onChange: (fields: Partial<AppLocation>) => void,
    closeModal: () => void
}

export function LocationModal ({active, description, source, onChange, closeModal} : LocationModalProps) {
    const [error, setError] = useState("");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleError = (message: string) => {
        setError(message);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
            setError("");
            timeoutRef.current = null;
        }, 5000);
    }

    const handleAddClicked = () => {
        if (source.latitude && !source.longitude) {
            handleError("Please enter a longitude value.");
            return;
        }
        
        if (source.longitude && !source.latitude) {
            handleError("Please enter a latitude value.");
            return;
        }
        
        if (source.longitude && source.longitude < -180 || source.longitude && source.longitude > 180) {
            handleError("Longitude must be between -180 and 180.")
            return;
        }
        
        if (source.latitude && source.latitude < -90 || source.latitude && source.latitude > 90) {
            handleError("Latitude must be between -90 and 90.")
            return;
        }

        if ((source.street == "" || source.address == "" || source.governorate == "")) {
            handleError("Please fill in the required fields");
            return;
        }
        
        if (source.googleMapsLink) {
            const regex = /^(https?:\/\/)?(www\.)?(google\.com\/maps|maps\.google\.com|goo\.gl)\/.+$/i;
            if (!regex.test(source.googleMapsLink)) {
                handleError("Please enter a valid Google Maps link.")
                return;
            }
        }

        closeModal();
    }

    if (active) {
        return (
            <div className="fixed flex-center w-full h-full top-0 left-0 bg-slate-900 bg-opacity-25 text-sm">
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
                                <input 
                                    min={-180}
                                    max={180}
                                    step={0.0001}
                                    type="text"
                                    onKeyDown={e => {
                                        if (e.key === "e") e.preventDefault()
                                    }}
                                    placeholder="Longitude (Optional)" 
                                    className="py-2 px-3 border-[1px] rounded-lg"
                                    value={source.longitude}
                                    onChange={(e) => onChange({longitude: parseFloat(e.target.value) || undefined})}
                                />
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span>Latitude</span>
                                <input 
                                    min={-90}
                                    max={90}
                                    step={0.0001}
                                    type="text" 
                                    onKeyDown={e => {
                                        if (e.key === "e") e.preventDefault()
                                    }} 
                                    placeholder="Longitude (Optional)" 
                                    className="py-2 px-3 border-[1px] rounded-lg"
                                    value={source.latitude}
                                    onChange={(e) => onChange({latitude: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-y-2">
                            <span>Building</span>
                            <input 
                                type="text" 
                                placeholder="Building Name (Optional)" 
                                className="py-2 px-3 border-[1px] rounded-lg"
                                value={source.building}
                                onChange={(e) => onChange({building: e.target.value})}
                            />
                        </div>
                        <div className="flex flex-col gap-y-2">
                            <span>Street*</span>
                            <input
                                type="text" 
                                placeholder="Street Name" 
                                className="py-2 px-3 border-[1px] rounded-lg"
                                value={source.street}
                                onChange={(e) => onChange({street: e.target.value})}
                            />
                        </div>
                        <div className="flex flex-col gap-y-2">
                            <span>Address*</span>
                            <input
                                type="text" 
                                placeholder="Address" 
                                className="py-2 px-3 border-[1px] rounded-lg"
                                value={source.address}
                                onChange={(e) => onChange({address: e.target.value})}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span>City</span>
                                <input
                                    type="text" 
                                    placeholder="City (Optional)" 
                                    className="py-2 px-3 border-[1px] rounded-lg"
                                    value={source.city}
                                    onChange={(e) => onChange({city: e.target.value})}
                                />
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span>Governorate*</span>
                                <input
                                    type="text" 
                                    placeholder="Governorate" 
                                    className="py-2 px-3 border-[1px] rounded-lg"
                                    value={source.governorate}
                                    onChange={(e) => onChange({governorate: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-x-4 py-6 border-b-[1px]">
                        <span>Google Maps Link: </span>
                        <input
                            type="text" 
                            placeholder="Insert link (⌘+v)" 
                            className="py-2 px-3 border-[1px] rounded-lg flex-1"
                            value={source.googleMapsLink}
                            onChange={(e) => onChange({googleMapsLink: e.target.value})}
                        />
                    </div>
                    <div className="flex items-center justify-end pt-4">
                        <Button variant="color" type="button" onClick={handleAddClicked}>Save Location</Button>
                    </div>
                </div>
            </div>
        )
    }

    return <></>
}

export default function LocationTrigger ({onClick} : {
    onClick: () => void
}) {
    return <Button onClick={onClick} type="button" variant="primary" className="flex items-center gap-x-2 text-[0.8125rem]"><MapPin className="w-4 h-4"/> Add Location</Button>
}