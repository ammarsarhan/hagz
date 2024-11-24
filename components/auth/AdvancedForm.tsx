import { useState, useEffect } from "react";
import { useFormContext } from "@/context/useFormContext";
import UploadTrigger, { UploadModal } from "@/components/ui/Upload";
import AppLocation from "@/utils/types/location";

export default function Advanced () {
    const [openUpload, setOpenUpload] = useState(false);

    const context = useFormContext();
    const source = context.data.location;
    
    const updateLocation = (fields: Partial<AppLocation>) => {
        context.updateData({
            location: {
                street: source?.street || "",
                address: source?.address || "",
                governorate: source?.governorate || "",
                ...source,
                ...fields
            }
        });
    }

    useEffect(() => {
        context.actions.setRenderBack(true);
        context.actions.setRenderNext(true);
    }, [])

    return (
        <>
            <UploadModal 
                active={openUpload} 
                closeModal={() => setOpenUpload(false)}
                title="Upload Image"
                label="Select a profile picture to show your account."
                description="Use a high quality, clear picture to appeal to your user audience better."
            />
            <div className="flex flex-col gap-y-4 text-sm mt-3 mb-6 w-2/3">
                <span className="text-dark-gray">Current Location</span>
                <div className="flex flex-col gap-y-2">
                    <span>Building</span>
                    <input 
                        value={source?.building}
                        onChange={e => updateLocation({building: e.target.value})}
                        type="text" 
                        placeholder="Building Name (Optional)" 
                        className="py-2 px-3 border-[1px] rounded-lg"
                    />
                </div>
                <div className="flex flex-col gap-y-2">
                    <span>Street</span>
                    <input 
                        value={source?.street}
                        onChange={e => updateLocation({street: e.target.value})}
                        type="text" 
                        placeholder="Street Name" 
                        className="py-2 px-3 border-[1px] rounded-lg"
                        required
                    />
                </div>
                <div className="flex flex-col gap-y-2">
                    <span>Address</span>
                    <input 
                        value={source?.address}
                        onChange={e => updateLocation({address: e.target.value})}
                        type="text" 
                        placeholder="Address" 
                        className="py-2 px-3 border-[1px] rounded-lg"
                        required
                    />
                </div>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                    <div className="flex flex-col flex-1 gap-y-2">
                        <span>City</span>
                        <input 
                            value={source?.city}
                            onChange={e => updateLocation({city: e.target.value})}
                            type="text" 
                            placeholder="City" 
                            className="py-2 px-3 border-[1px] rounded-lg"
                            required
                        />
                    </div>
                    <div className="flex flex-col flex-1 gap-y-2">
                        <span>Governorate</span>
                        <input 
                            value={source?.governorate}
                            onChange={e => updateLocation({governorate: e.target.value})}
                            type="text" 
                            placeholder="Governorate" 
                            className="py-2 px-3 border-[1px] rounded-lg"
                            required
                        />
                    </div>
                </div>
                <div className="flex gap-x-4 items-center justify-between mt-4">
                    <span className="text-dark-gray">Upload profile picture (optional):</span>
                    <UploadTrigger onClick={() => setOpenUpload(true)} label="Add Image"/>
                </div>
            </div>
        </>
    )
}