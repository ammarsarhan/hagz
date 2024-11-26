import UploadTrigger, { UploadModal } from "@/components/ui/Upload";
import AmenitiesTrigger, { AmenitiesModal } from "@/components/ui/Amenities";
import Button from "@/components/ui/Button";
import { useEffect, useState } from "react";
import { useOwnerFormContext } from "@/context/useOwnerFormContext";
import usePitchFormContext from "@/context/usePitchFormContext";

export default function Continued () {
    const ownerContext = useOwnerFormContext();
    const pitchContext = usePitchFormContext();

    const [uploadOpen, setUploadOpen] = useState(false);
    const [amenitiesOpen, setAmenitiesOpen] = useState(false);

    useEffect(() => {
        ownerContext.actions.setRenderNext(true);
        ownerContext.actions.setRenderBack(true);
    }, [])

    return (
        <>
            <UploadModal 
                active={uploadOpen} 
                closeModal={() => setUploadOpen(false)}
            />
            <AmenitiesModal 
                active={amenitiesOpen}
                source={pitchContext.data.amenities!}
                handleAdd={(amenity) => pitchContext.updateData({amenities: [...pitchContext.data.amenities!, amenity]})}
                closeModal={() => setAmenitiesOpen(false)}
            />
            <div className="flex flex-col gap-8 my-4 text-sm w-2/3">
                <div className="flex items-center justify-between gap-x-4">
                    <span className="text-dark-gray">Pitch Images ({pitchContext.data.images?.length})</span>
                    <UploadTrigger onClick={() => setUploadOpen(true)}/>
                </div>
                <div>
                    <span className="block mb-4 text-dark-gray">Pitch Amenities</span>
                    <div className="flex flex-wrap items-center gap-4 w-full rounded-md border-[1px] p-4">
                        {
                            pitchContext.data.amenities?.map((el, index) => {
                                return (
                                    <div className="px-6 py-3 rounded-full text-sm h-fit flex items-center gap-x-2 text-[0.8125rem]">{index + 1}) {el}</div>
                                )
                            })
                        }
                        <AmenitiesTrigger onClick={() => setAmenitiesOpen(true)} state={pitchContext.data.amenities?.length == 0 ? "Large" : "Small"}/>
                    </div>
                </div>
            </div>
        </>
    )
}