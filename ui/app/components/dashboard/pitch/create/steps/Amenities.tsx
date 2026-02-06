import { useEffect, useReducer, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";

import useFormContext from "@/app/context/Form";
import Button from "@/app/components/base/Button";
import AmenityCard from "@/app/components/dashboard/AmenityCard";
import { InputGroup } from "@/app/components/dashboard/Input";
import { DropdownGroup } from "@/app/components/dashboard/Dropdown";
import { TextAreaGroup } from "@/app/components/dashboard/TextArea";
import { createAmenitySchema } from "@/app/schemas/pitch";
import { Amenity, amenityOptions, CreatePitchFormType } from "@/app/utils/types/dashboard";

import { FaPlus } from "react-icons/fa6";

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
        id: uuidv4(),
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
        dispatch({ field: "id", value: uuidv4() });
        dispatch({ field: "name", value: "" });
        dispatch({ field: "description", value: "" });
        dispatch({ field: "isPaid", value: false });
        dispatch({ field: "price", value: "" });
    };

    const handleAppend = () => {
        const parsed = createAmenitySchema.safeParse(state);

        if (!parsed.success) {
            console.log(state, parsed.error.issues);
            return;
        }

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
                        <span className="text-sm font-medium">Amenity Details</span>
                        <button className="underline text-sm text-gray-500/80 hover:text-gray-500 transition-all" onClick={handleReset}>Reset</button>
                    </div>
                    <div className="flex items-end justify-center gap-x-2 w-full">
                        <DropdownGroup label={"Amenity"} placeholder={"Select Amenity"} value={state.name} onChange={(value) => dispatch({ field: "name", value })} options={amenityOptions} className="flex-1"/>
                        <DropdownGroup placeholder={"Is Paid?"} value={state.isPaid ? "YES" : "NO"} onChange={(value) => dispatch({ field: "isPaid", value: (value === "YES" ? true : false) })} options={[{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }]} className="flex-1" label={"Is Paid?"}/>
                        <AnimatePresence mode="wait">
                            {
                                state.isPaid &&
                                <motion.div
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <InputGroup label={"Price"} type={"text"} placeholder={"Price/hr"} value={state.price} onChange={(e) => dispatch({ field: "price", value: e.target.value })} />
                                </motion.div>
                            }
                        </AnimatePresence>
                        <Button variant="mono" onClick={handleAppend}>
                            <FaPlus className="size-3"/>
                            <span>Add amenity</span>
                        </Button>
                    </div>
                    <div>
                        <TextAreaGroup label={"Additional Description"} placeholder={"Description"} resize={false} value={state.description} onChange={(e) => dispatch({ field: "description", value: e.target.value })} />
                    </div>
                </div>
                <AnimatePresence mode="wait">
                    {
                        data.amenities.length > 0 ?
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col gap-y-3 w-full"
                        >
                            <span className="text-sm">Amenities ({data.amenities.length})</span>
                            <div className="flex gap-x-4 overflow-x-scroll" ref={amenitiesRef}>
                                <AnimatePresence mode="popLayout">
                                    {
                                        data.amenities.map(amenity => <AmenityCard key={amenity.id} {...amenity}/> )
                                    }
                                </AnimatePresence>
                            </div>
                        </motion.div> :
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col gap-y-1 w-full"
                        >
                            <span className="text-sm">Amenities (0)</span>
                            <p className="text-gray-600 text-xxs">You do not have any amenities added yet. Please add at least one amenity to your pitch.</p>
                        </motion.div>
                    }
                </AnimatePresence>
            </motion.div>
        </>
    )
}