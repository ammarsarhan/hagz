import { Amenity, amenityOptions } from "@/app/utils/types/dashboard";
import { motion } from "framer-motion";
import { FaRegTrashAlt } from "react-icons/fa";

type AmenityCardProps = Amenity & { index: number }

export default function AmenityCard({ name, description, isPaid, price, index } : AmenityCardProps) {
    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            layout
            className="rounded-t-md border border-gray-200 w-xs shrink-0">
            <div className="p-4 border-b border-gray-200 flex items-center gap-x-3">
                <div className="rounded-full size-5 border border-gray-300 text-black flex-center">
                    <span className="text-xs">{index + 1}</span>
                </div>
                <div>
                    <span className="text-sm font-medium">{amenityOptions.find(a => a.value === name)?.label}</span>
                    <p className="text-gray-600 text-xxs">{description ? description : "No description provided."}</p>
                </div>
            </div>
            <div className="p-4 grid grid-cols-2 grid-rows-2 gap-4">
                <div className="flex flex-col text-xxs">
                    <span>Code</span>
                    <span className="text-gray-500">{name}</span>
                </div>
                <div className="flex flex-col text-xxs">
                    <span>Is Paid?</span>
                    <span className="text-gray-500">{isPaid ? "Yes" : "No"}</span>
                </div>
                <div className="flex flex-col text-xxs">
                    <span>Price</span>
                    <span className="text-gray-500">{price ? price : "N/A"}</span>
                </div>
            </div>
            <button className="w-full flex-center gap-x-1.5 bg-black rounded-b-md py-2.5 my-1 text-white hover:bg-black/75 transition-all">
                <FaRegTrashAlt className="size-3"/>
                <span className="text-xxs">Delete</span>
            </button>
        </motion.div>
    )
}