import { ReactNode } from "react";
import { DoorClosed, Plus, X, CircleCheck, Armchair, Lightbulb, CarFront, ShowerHead, Vault, Apple, BriefcaseMedical, Lock, Edit } from "lucide-react";

import Button from "@/components/ui/Button";
import { Amenity } from "@/utils/types/pitch";

const amenities = [
    {
        title: "Indoors",
        icon: <DoorClosed className="w-4 h-4"/>
    },
    {
        title: "Ball Provided",
        icon: <DoorClosed className="w-4 h-4"/>
    },
    {
        title: "Seating",
        icon: <Armchair className="w-4 h-4"/>
    },
    {
        title: "Night Lights",
        icon: <Lightbulb className="w-4 h-4"/>
    },
    {
        title: "Parking",
        icon: <CarFront className="w-4 h-4"/>
    },
    {
        title: "Showers",
        icon: <ShowerHead className="w-4 h-4"/>
    },
    {
        title: "Changing Rooms",
        icon: <Vault className="w-4 h-4"/>
    },
    {
        title: "Cafeteria",
        icon: <Apple className="w-4 h-4"/>
    },
    {
        title: "First Aid",
        icon: <BriefcaseMedical className="w-4 h-4"/>
    },
    {
        title: "Security",
        icon: <Lock className="w-4 h-4"/>
    }
]

interface AmenitiesModalProps {
    active: boolean
    source: Amenity[]
    handleAdd: (amenity: Amenity) => void
    closeModal: () => void
}

interface AmenityButtonProps {
    title: string,
    icon: ReactNode,
    selected: boolean,
    onClick: () => void
}

export function AmenityButton ({title, icon, selected, onClick} : AmenityButtonProps) {
    return (
        <button onClick={onClick} type="button" className={`w-fit h-fit px-4 py-2 border-[1px] rounded-3xl flex items-center hover:bg-gray-50 transition-color ${selected ? "justify-between" : "justify-center text-dark-gray"} gap-x-6`}>
            <div className="flex-center gap-x-2">
                {icon}
                {title}
            </div>
            {
                selected &&
                <div className="rounded-full text-primary-green">
                    <CircleCheck className="w-4 h-4"/>
                </div>
            }
        </button>
    )
}

export function AmenitiesModal ({active, source, handleAdd, closeModal} : AmenitiesModalProps) {
    const handleAmenityClick = (amenity: Amenity) => {
        if (source.includes(amenity)) {
            const i = source.indexOf(amenity);
            source.splice(i, 1);
        } else {
            handleAdd(amenity);
        }

        closeModal();
    }

    if (active) {
        return (
            <div className="fixed flex-center w-full h-full top-0 left-0 bg-slate-900 bg-opacity-25 text-sm">
                <div className="relative my-4 p-8 rounded-md bg-white overflow-y-scroll h-full sm:h-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-base font-medium mb-1">Select Amenities</h3>
                            <p className="text-dark-gray">Choose an amenity that applies to your pitch.</p>
                        </div>
                        <button onClick={closeModal} className="absolute top-6 right-6"><X className="w-5 h-5 text-dark-gray"/></button>
                    </div>
                    <div className="flex flex-wrap overflow-y-scroll border-[1px] rounded-md w-96 h-56 p-4 gap-4">
                        {
                            amenities.map((el, index) => {
                                const code = el.title as Amenity;

                                if (source.includes(code)) {
                                    return <AmenityButton title={el.title} icon={el.icon} selected onClick={() => handleAmenityClick(code)} key={index}/>
                                }

                                return <AmenityButton title={el.title} icon={el.icon} selected={false} onClick={() => handleAmenityClick(code)} key={index}/>
                            })
                        }
                    </div>
                </div>
            </div>
        )
    }

    return <></>
}

export default function AmenitiesTrigger ({onClick, state} : {
    onClick: () => void,
    state: "Large" | "Small"
}) {
    if (state == "Large") {
        return <Button onClick={onClick} variant="primary" className="h-fit flex items-center gap-x-2 text-[0.8125rem]" type="button"><Plus className="w-4 h-4"/> Add Amenity</Button>
    }
    else if (state = "Small") {
        return <button onClick={onClick} className="flex-center border-[1px] rounded-full h-8 w-8 hover:bg-gray-50 transition-color" type="button"><Plus className="w-4 h-4"/></button>
    }
}