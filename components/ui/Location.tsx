import { useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { useFormContext } from "@/context/useFormContext";

import Button from "@/components/ui/Button";
import AppLocation from '@/utils/types/location'

interface LocationModalProps {
    active: boolean
    description: string,
    source: AppLocation,
    closeModal: () => void
}

export function LocationModal ({active, description, source, closeModal} : LocationModalProps) {
    const context = useFormContext();

    const [error, setError] = useState("");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const updateLocation = (fields: Partial<AppLocation>) => {
        context.updateBilling({
            details: {
                location: {
                    ...source,
                    ...fields
                } 
            }
        })
    }

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
        if ((source.street === "" || source.address === "" || source.governorate === "") && source.googleMapsLink === "") {
            handleError("Please fill in the required fields");
            return;
        } else if (source.longitude && source.longitude < -180 || source.longitude && source.longitude > 180) {
            handleError("Longitude must be between -180 and 180.")
            return;
        } else if (source.latitude && source.latitude < -90 || source.latitude && source.latitude > 90) {
            handleError("Latitude must be between -90 and 90.")
            return;
        } else if (source.googleMapsLink) {
            const regex = /^(https?:\/\/)?(www\.)?(google\.com\/maps|maps\.google\.com|goo\.gl)\/.+$/i;
            if (!regex.test(source.googleMapsLink)) {
                handleError("Please enter a valid Google Maps link.")
                return;
            };
        }

        setError("");
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
                                    value={source.longitude || ""}
                                    onChange={e => updateLocation({longitude: parseFloat(e.target.value)})}
                                    min={-180}
                                    max={180}
                                    step={0.0001}
                                    type="text"
                                    onKeyDown={e => {
                                        if (e.key === "e") e.preventDefault()
                                    }} 
                                    placeholder="Longitude (Optional)" 
                                    className="py-2 px-3 border-[1px] rounded-lg"
                                />
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span>Latitude</span>
                                <input 
                                    value={source.latitude || ""}
                                    onChange={e => updateLocation({latitude: parseFloat(e.target.value)})}
                                    min={-90}
                                    max={90}
                                    step={0.0001}
                                    type="text" 
                                    onKeyDown={e => {
                                        if (e.key === "e") e.preventDefault()
                                    }} 
                                    placeholder="Longitude (Optional)" 
                                    className="py-2 px-3 border-[1px] rounded-lg"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-y-2">
                            <span>Building</span>
                            <input 
                                value={source.building}
                                onChange={e => updateLocation({building: e.target.value})}
                                type="text" 
                                placeholder="Building Name (Optional)" 
                                className="py-2 px-3 border-[1px] rounded-lg"
                            />
                        </div>
                        <div className="flex flex-col gap-y-2">
                            <span>Street</span>
                            <input 
                                value={source.street}
                                onChange={e => updateLocation({street: e.target.value})}
                                type="text" 
                                placeholder="Street Name" 
                                className="py-2 px-3 border-[1px] rounded-lg"
                            />
                        </div>
                        <div className="flex flex-col gap-y-2">
                            <span>Address</span>
                            <input 
                                value={source.address}
                                onChange={e => updateLocation({address: e.target.value})}
                                type="text" 
                                placeholder="Address" 
                                className="py-2 px-3 border-[1px] rounded-lg"/>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span>City</span>
                                <input 
                                    value={source.city}
                                    onChange={e => updateLocation({city: e.target.value})}
                                    type="text" 
                                    placeholder="City (Optional)" 
                                    className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span>Governorate</span>
                                <input 
                                    value={source.governorate}
                                    onChange={e => updateLocation({governorate: e.target.value})}
                                    type="text" 
                                    placeholder="Governorate" 
                                    className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-x-4 py-6 border-b-[1px]">
                        <span>Google Maps Link: </span>
                        <input 
                            value={source.googleMapsLink}
                            onChange={e => updateLocation({googleMapsLink: e.target.value})}
                            type="text" 
                            placeholder="Insert link (⌘+v)" 
                            className="py-2 px-3 border-[1px] rounded-lg flex-1"
                        />
                    </div>
                    <div className="flex items-center justify-end pt-4">
                        <Button variant="color" type="button" onClick={handleAddClicked}>Add Location</Button>
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