import { useReducer, useState } from "react";
import { AnimatePresence } from "framer-motion";

import Button from "@/app/components/base/Button";
import { Modal } from "@/app/components/base/Modal";
import { Ground, Pitch } from "@/app/utils/types/dashboard";
import { ground } from "@/app/utils/dashboard/config";

import Details from "@/app/components/dashboard/pitch/create/modals/steps/Details";
import Payment from "@/app/components/dashboard/pitch/create/modals/steps/Payment";
import Schedule from "@/app/components/dashboard/pitch/create/modals/steps/Schedule";
import Pricing from "@/app/components/dashboard/pitch/create/modals/steps/Pricing";

import { IoIosClose } from "react-icons/io";
import useFormContext from "@/app/context/Form";

export interface CreateGroundModalAction {
    type: "clear" | "set";
    field: keyof Ground | "*";
    value?: string | string[] | number[];
};

function createGroundModalReducer(state: Ground, action: CreateGroundModalAction) {
    switch (action.type) {
        case "set":
            {
                return {
                    ...state,
                    [action.field]: action.value,
                };
            }
        case "clear":
            {
                return { ...ground };
            }
    };
};

export default function GroundModal({ isOpen, onClose } : { isOpen: boolean, onClose: () => void }) {
    const [index, setIndex] = useState(0);
    const [state, dispatch] = useReducer(createGroundModalReducer, { ...ground });
    const { setData } = useFormContext<Pitch>();

    const steps = [
        {
            label: "Ground Details",
            description: "Basic information about your ground including the name, description, sport, surface, size, etc...",
            component: <Details state={state} dispatch={dispatch}/>
        },
        {
            label: "Pricing & Payment",
            description: "Details about your ground's pricing including the base price, deposit fee, peak and discount pricing, etc..",
            component: <Payment state={state} dispatch={dispatch}/>
        },
        {
            label: "Base Schedule",
            description: "Details about your ground's schedule including open and closing hours, maintenance breaks, staff breaks, etc..",
            component: <Schedule state={state} dispatch={dispatch}/>
        },
        {
            label: "Pricing Schedule",
            description: "When does your ground pricing fluctuate? Select your peak and discount hours by clicking once or twice on the available operating hours.",
            component: <Pricing state={state} dispatch={dispatch}/>
        },
    ];
    
    const next = () => {
        if (index >= steps.length - 1) return;
        setIndex(prev => prev + 1);
    };
    
    const previous = () => {
        if (index <= 0) return;
        setIndex(prev => prev - 1);
    };

    const finish = () => {
        setData(prev => ({ 
            ...prev, 
            layout: { 
                ...prev.layout, 
                grounds: [...prev.layout.grounds, state] 
            }
        }));

        setIndex(0);
        dispatch({ type: "clear", field: "*" });
        onClose();
    };

    const isLast = index === steps.length - 1;
    const activeStep = steps[index];

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="flex flex-col gap-y-2 w-full md:w-2xl bg-white rounded-md p-6 m-4">
            <div className="w-full flex items-start justify-between gap-x-2">
                <div className="flex-center flex-col gap-y-4 p-2">
                    <div className="flex flex-col gap-y-0.5">
                        <h1 className="font-semibold">{activeStep.label}</h1>
                        <p className="text-xxs text-gray-700">{activeStep.description}</p>
                    </div>
                </div>
                <button type="button" className="text-gray-700 hover:text-gray-500 transition-colors" onClick={onClose}>
                    <IoIosClose className="size-6"/>
                </button>
            </div>
            <div className="p-2">
                <AnimatePresence mode="wait">
                    {activeStep.component}
                </AnimatePresence>
            </div>
            <div className="flex gap-x-2 w-full justify-end mt-3">
                <Button variant="outline" onClick={previous}>Previous</Button>
                <Button variant="mono" onClick={isLast ? finish : next}>{isLast ? "Finish" : "Next"}</Button>
            </div>
        </Modal>
    )
};
