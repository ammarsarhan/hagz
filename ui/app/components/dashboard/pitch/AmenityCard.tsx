import { useReducer, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import { Modal } from "@/app/components/base/Modal";
import Button from "@/app/components/base/Button";
import { DropdownGroup } from "@/app/components/dashboard/Dropdown";
import { UnitInputGroup } from "@/app/components/dashboard/UnitInput";
import { TextAreaGroup } from "@/app/components/dashboard/TextArea";
import { AmenityType, amenityIcons, amenityOptions, Pitch } from "@/app/utils/types/dashboard";

import { FaRegTrashAlt } from "react-icons/fa";
import { FaEllipsisVertical } from "react-icons/fa6";
import { IoIosClose } from "react-icons/io";

type AmenityCardProps = AmenityType;
type EditAmenityPayload = AmenityType;

interface EditAmenityAction {
  field: keyof EditAmenityPayload;
    value: string | boolean
}

function editAmenityReducer(state: EditAmenityPayload, action: EditAmenityAction) {
    return {
        ...state,
        [action.field]: action.value,
    };
};

const EditAmenityModal = ({ amenity, isOpen, onClose } : { amenity: AmenityType, isOpen: boolean, onClose: () => void }) => {
    const { data, setData } = useFormContext<Pitch>();
    const [state, dispatch] = useReducer(editAmenityReducer, amenity);

    const label = amenityOptions.find(a => a.value === state.name)!.label;
    
    const handleSave = () => {
        setData(prev => ({
            ...prev,
            amenities: prev.amenities.map(a =>
                a.id === amenity.id ? state : a
            )
        }));

        onClose();
    };

    return (
        <Modal isOpen={isOpen} className="flex flex-col gap-y-2 w-full md:w-xl bg-white rounded-md p-6 m-4" onClose={onClose}>
            <div className="w-full flex items-start justify-between gap-x-2">
                <div className="flex-center flex-col gap-y-4 p-2">
                    <div className="flex flex-col gap-y-0.5">
                        <h1 className="font-semibold">Edit {label}</h1>
                        <p className="text-xxs text-gray-700">Make changes to your amenity in tag, description, pricing, etc...</p>
                    </div>
                </div>
                <button type="button" className="text-gray-700 hover:text-gray-500 transition-colors" onClick={onClose}>
                    <IoIosClose className="size-6"/>
                </button>
            </div>
            <div className="flex flex-col gap-y-4 p-2">
                <DropdownGroup label={"Amenity"} placeholder={"Select Amenity"} value={state.name} onChange={(value) => dispatch({ field: "name", value })} options={amenityOptions} className="flex-1"/>
                <div className="flex gap-x-2 w-full">
                    <DropdownGroup placeholder={"Is Paid?"} value={state.isPaid ? "YES" : "NO"} onChange={(value) => dispatch({ field: "isPaid", value: (value === "YES" ? true : false) })} options={[{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }]} className="flex-1 w-1/2" label={"Is Paid?"}/>
                    <AnimatePresence mode="wait">
                        {
                            state.isPaid &&
                            <motion.div
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            >
                                <UnitInputGroup 
                                    label={`Price (in ${data.currency})`}
                                    placeholder={"Price"}
                                    value={state.price}
                                    onChange={(e) => dispatch({ field: "price", value: e.target.value })}
                                    unit={state.unit}
                                    onUnitChange={(e) => dispatch({ field: "unit", value: e })} 
                                    unitOptions={[{ value: "BOOKING", label: "Per booking" }, { value: "HOUR", label: "Per hour" }]}
                                />
                            </motion.div>
                        }
                    </AnimatePresence>
                </div>
                <div>
                    <TextAreaGroup label={"Additional Description"} placeholder={"Description"} resize={false} value={state.description} onChange={(e) => dispatch({ field: "description", value: e.target.value })} />
                </div>
            </div>
            <div className="w-full flex items-center justify-end px-2 pt-2">
                <Button variant="mono" onClick={handleSave}>
                    <span>Save Changes</span>
                </Button>
            </div>
        </Modal>
    )
}

export default function AmenityCard({ id, name, description, isPaid, price, unit } : AmenityCardProps) {
    const { data, setData } = useFormContext<Pitch>();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const formattedPrice = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: data.currency,
    }).format(Number(price));

    const label = amenityOptions.find(amenity => amenity.value === name)!.label;
    const IconComponent = amenityIcons.find(amenity => amenity.value === name)!.icon;

    const handleDelete = () => {
        const amenities = data.amenities.filter(amenity => amenity.id !== id);

        setData(prev => ({
            ...prev,
            amenities
        }));
    };

    return (
        <>
            <EditAmenityModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                amenity={{ id, name, description, isPaid, price, unit }}
            />
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                layout
                className="relative w-[18rem] shrink-0 flex flex-col h-full"
            >
                <div className="flex items-center gap-x-4 p-4 rounded-t-md border border-gray-200">
                    <IconComponent className="size-4.5"/>
                    <div className="flex flex-col gap-y-0.5 flex-1">
                        <span className="text-sm font-medium">{label}</span>
                        <p className="text-xs text-gray-500">{id}</p>
                    </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-y-4 border-x border-gray-200 text-xxs">
                    <div className="grid grid-cols-3 gap-x-4">
                        <div className="flex flex-col w-full">
                            <span className="text-gray-500">Tag</span>
                            <span className="block truncate">{name}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-500">Is Paid?</span>
                            <span>{isPaid ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-500">Price{unit === "HOUR" && "/hr"}</span>
                            <span>{price ? formattedPrice : "Free"}</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500">Description</span>
                        <p>{description ? description : "No additional description."}</p>
                    </div>
                </div>
                <button onClick={handleDelete} className="p-2.75 flex-center gap-x-1.5 bg-black text-white hover:bg-black/85 transition-all w-full rounded-b-md">
                    <FaRegTrashAlt className="size-3"/>
                    <span className="text-xs">Delete</span>
                </button>
                <button className="absolute flex-center size-6 hover:bg-gray-200/75 rounded-full transition-all right-2.25 top-2.5" onClick={() => setIsModalOpen(true)}>
                    <FaEllipsisVertical className="size-3"/>
                </button>
            </motion.div>
        </>
    )
}