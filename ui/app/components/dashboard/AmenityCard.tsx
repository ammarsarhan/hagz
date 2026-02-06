import { motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import { Amenity, amenityIcons, amenityOptions, CreatePitchFormType } from "@/app/utils/types/dashboard";
import { FaRegTrashAlt } from "react-icons/fa";

type AmenityCardProps = Amenity;

export default function AmenityCard({ id, name, description, isPaid, price } : AmenityCardProps) {
    const { data, setData } = useFormContext<CreatePitchFormType>();

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
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            layout
            className="w-[18rem] shrink-0 flex flex-col h-full"
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
                        <span className="block break-all">{name}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500">Is Paid?</span>
                        <span>{isPaid ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500">Price/hr</span>
                        <span>{price ? price : "Free"}</span>
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
        </motion.div>
    )
}