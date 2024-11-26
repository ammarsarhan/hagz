import LocationTrigger, { LocationModal } from "@/components/ui/Location"
import { useOwnerFormContext } from "@/context/useOwnerFormContext";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button"
import AppLocation from '@/utils/types/location';

import { ArrowLeft } from "lucide-react";
import usePitchFormContext from "@/context/usePitchFormContext";

export default function Pitch () {
    const ownerContext = useOwnerFormContext();
    const pitchContext = usePitchFormContext();

    const [locationOpen, setLocationOpen] = useState(false);

    useEffect(() => {
        switch (pitchContext.mode) {
            case "Initial":
                ownerContext.actions.setRenderBack(false);
                ownerContext.actions.setRenderNext(false);
                break;
            
            case "Create":
                ownerContext.actions.setRenderBack(false);
                ownerContext.actions.setRenderNext(true);
                break;

            case "Link":
                ownerContext.actions.setRenderBack(false);
                ownerContext.actions.setRenderNext(true);
                break;
        }
    }, [pitchContext.mode]);

    if (pitchContext.mode === "Initial") {
        return (
            <div className="flex flex-col items-center gap-y-6 my-4">
                <p className="text-center text-[0.9375rem]">Does your pitch already exist?</p>
                <div className="flex-center flex-col sm:flex-row gap-y-3 gap-x-6">
                    <Button variant="color" onClick={() => {
                        pitchContext.setMode("Create")
                    }}>Create a New Pitch</Button>
                    <span className="text-dark-gray text-sm">or</span>
                    <Button variant="primary" onClick={() => {
                        pitchContext.setMode("Link")  
                    }}>Pitch Already Exists</Button>
                </div>
                <p className="text-sm text-dark-gray text-center w-3/4 mt-2">Linking a new pitch to this account will mean transferring pitch ownership from the previous account.</p>
            </div>
        )
    }

    if (pitchContext.mode === "Link") {
        return (
            <>
                <button className="hover:text-black transition-all absolute top-2 left-2 flex-center text-dark-gray gap-x-2" type="button" onClick={() => pitchContext.setMode("Initial")}>
                    <ArrowLeft className="w-4 h-4"/>
                    <span className="text-sm">Back</span>
                </button>
                <div className="flex-center flex-col gap-y-6 text-sm w-3/4 my-4">
                    <div className="flex flex-col gap-2 flex-1 w-full">
                        <span className="text-dark-gray">Pitch link:</span>
                        <input 
                            type="text" 
                            placeholder="ex: https://hagz.com/pitch/abcd" 
                            pattern="(https://www\.hagz\.com/pitch/.*|www\.hagz\.com/pitch/.*|hagz\.com/pitch/.*)" 
                            className="py-2 px-3 border-[1px] rounded-lg w-full"
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-2 flex-1 w-full">
                        <span className="text-dark-gray">Secret Transfer Key:</span>
                        <input 
                            type="text" 
                            placeholder="Transfer Key" 
                            className="py-2 px-3 border-[1px] rounded-lg w-full"
                            required
                        />
                    </div>
                    <p className="text-dark-gray text-center">Note: This is a <span className="italic">destructive</span> ownership transfer action. <br/> Make sure you completely understand what you are doing.</p>
                </div>
            </>
        )
    }

    if (pitchContext.mode === "Create") {
        return (
            <>
                <button className="hover:text-black transition-all absolute top-2 left-2 flex-center text-dark-gray gap-x-2" type="button" onClick={() => pitchContext.setMode("Initial")}>
                    <ArrowLeft className="w-4 h-4"/>
                    <span className="text-sm">Back</span>
                </button>
                <LocationModal 
                    active={locationOpen} 
                    description="Add your pitch location manually or through Google Maps."
                    source={pitchContext.location as AppLocation}
                    onChange={(fields: Partial<AppLocation>) => pitchContext.updateLocation(fields)}
                    closeModal={() => setLocationOpen(false)}
                />
                <div className="my-4 text-sm w-3/4">
                    <div className="flex flex-col items-start flex-wrap md:flex-row gap-x-10 gap-y-6">
                        <div className="flex flex-col flex-1 gap-y-3 w-full">
                            <div className="flex flex-col gap-2 flex-1">
                                <span className="text-dark-gray">Pitch Name</span>
                                <input 
                                    required 
                                    type="text" 
                                    placeholder="Name" 
                                    className="py-2 px-3 border-[1px] rounded-lg"
                                    value={pitchContext.data.name}
                                    onChange={(e) => pitchContext.updateData({name: e.target.value})}
                                />
                            </div>
                            <div className="flex flex-col gap-2 flex-1 my-2">
                                <span className="text-dark-gray">Pitch Description</span>
                                <input 
                                    type="text" 
                                    placeholder="Description (50 words max)" 
                                    className="py-2 px-3 border-[1px] rounded-lg"
                                    value={pitchContext.data.description}
                                    onChange={(e) => pitchContext.updateData({description: e.target.value})}
                                />
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                                <div className="flex items-center justify-between my-2 gap-x-4">
                                    <span className="text-dark-gray">Pitch Size</span>
                                    <select 
                                        required 
                                        className="border-b-[1px] py-2 pr-5 outline-none"
                                        value={pitchContext.data.pitchSize}
                                        onChange={(e) => pitchContext.updateData({pitchSize: e.target.value as "5-A-Side" | "7-A-Side" | "11-A-Side"})}
                                    >
                                        <option value="5-A-Side">5-A-Side</option>
                                        <option value="7-A-Side">7-A-Side</option>
                                        <option value="11-A-Side">11-A-Side</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between my-2 gap-x-4">
                                    <span className="text-dark-gray">Ground Type</span>
                                    <select 
                                        required 
                                        className="border-b-[1px] py-2 pr-5 outline-none"
                                        value={pitchContext.data.groundType}
                                        onChange={(e) => pitchContext.updateData({groundType: e.target.value as "AG" | "SG" | "FG" | "TF"})}    
                                    >
                                        <option value="AG">Artifical Ground</option>
                                        <option value="SG">Soft Ground</option>
                                        <option value="FG">Firm Ground</option>
                                        <option value="TF">Astro Turf</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between my-2 gap-x-4">
                                    <div className="flex flex-col gap-1 text-dark-gray">
                                        <span>Price Per Hour</span>
                                        <span className="w-2/3">(Custom pricing options will be available once pitch is created)</span>
                                    </div>
                                    <input 
                                        required
                                        type="number" 
                                        min={100} 
                                        max={9999} 
                                        maxLength={4} 
                                        placeholder="Price" 
                                        className="border-b-[1px] p-2 !outline-0 w-24"
                                        value={pitchContext.data.activePricingPlan?.price}
                                        onChange={(e) => pitchContext.updateData({activePricingPlan: {
                                            price: parseInt(e.target.value), 
                                            deposit: null, 
                                            discount: null
                                        }})}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between my-4 gap-x-4">
                                <span>Pitch Location</span>
                                <LocationTrigger onClick={() => setLocationOpen(true)}/>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )
    }
}