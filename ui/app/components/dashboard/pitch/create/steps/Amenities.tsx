import { useEffect, useReducer, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import Input from "@/app/components/dashboard/Input";
import Dropdown from "@/app/components/dashboard/Dropdown";
import TextArea from "@/app/components/dashboard/TextArea";
import Button from "@/app/components/base/Button";
import { Amenity, amenityOptions, CreatePitchFormType } from "@/app/utils/types/dashboard";

import { FaPlus } from "react-icons/fa6";
import AmenityCard from "../../../AmenityCard";

type CreateAmenityPayload = Amenity;

interface CreateAmenityAction {
    field: keyof CreateAmenityPayload
    value: string | boolean
}

function createUserReducer(state: CreateAmenityPayload, action: CreateAmenityAction) {
    return {
        ...state,
        [action.field]: action.value,
    };
};

export default function Amenities() {
    const { data, setData } = useFormContext<CreatePitchFormType>();

    const [state, dispatch] = useReducer(createUserReducer, {
        name: "LIGHTING",
        description: "",
        isPaid: false,
        price: ""
    });

    const amenitiesRef = useRef<HTMLDivElement | null>(null);
    const prevLength = useRef(data.amenities.length);

    useEffect(() => {
        if (!amenitiesRef.current) return;

        if (data.amenities.length > prevLength.current) {
            const wrapper = amenitiesRef.current;

            wrapper.scrollTo({
                left: wrapper.scrollWidth,
                behavior: "smooth",
            });
        }

        prevLength.current = data.amenities.length;
    }, [data.amenities.length]);

    const handleReset = () => {
        dispatch({ field: "name", value: "" });
        dispatch({ field: "description", value: "" });
        dispatch({ field: "isPaid", value: "" });
        dispatch({ field: "price", value: "" });
    };

    const handleAppend = () => {
        setData(prev => ({
            ...prev,
            amenities: [
                ...prev.amenities,
                state
            ]
        }));

        handleReset();
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[calc(100vh-2rem)] flex-center flex-col gap-y-6 w-3xl"
            >
                <div className="flex flex-col gap-y-3 w-full">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-sm">Amenity Details</span>
                        <button className="underline text-sm text-gray-500/80 hover:text-gray-500 transition-all" onClick={handleReset}>Reset</button>
                    </div>
                    <div className="flex items-center gap-x-2 w-full">
                        <Dropdown placeholder={"Select Amenity"} value={state.name} onChange={(value) => dispatch({ field: "name", value })} options={amenityOptions} className="flex-1"/>
                        <Dropdown placeholder={"Is Paid?"} value={state.isPaid ? "YES" : "NO"} onChange={(value) => dispatch({ field: "isPaid", value: value === "YES" })} options={[{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }]} className="flex-1"/>
                        <AnimatePresence>
                            {
                                state.isPaid &&
                                <motion.div
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <Input type={"text"} placeholder={"Price/hr"} value={state.price} onChange={(e) => dispatch({ field: "price", value: e.target.value })} />
                                </motion.div>
                            }
                        </AnimatePresence>
                        <Button variant="mono" onClick={handleAppend}>
                            <FaPlus className="size-3"/>
                            <span>Add amenity</span>
                        </Button>
                    </div>
                    <div>
                        <TextArea placeholder={"Description"} resize={false} value={state.description} onChange={(e) => dispatch({ field: "description", value: e.target.value })} />
                    </div>
                </div>
                <div className="flex flex-col gap-y-3 w-full">
                    <span className="text-sm">Amenities ({data.amenities.length})</span>
                    <div className="flex gap-x-4 overflow-x-scroll" ref={amenitiesRef}>
                        {
                            data.amenities.map((amenity, index) => <AmenityCard key={index} {...amenity} index={index}/> )
                        }
                    </div>
                </div>
            </motion.div>
        </>
    )
}