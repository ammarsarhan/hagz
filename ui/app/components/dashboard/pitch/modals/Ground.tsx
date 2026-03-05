import { useReducer, useState } from "react";
import { AnimatePresence } from "framer-motion";

import Button from "@/app/components/base/Button";
import { Modal } from "@/app/components/base/Modal";
import { Ground, GroundSize, Pitch } from "@/app/utils/types/dashboard";
import { defaults, ground } from "@/app/utils/dashboard/config";

import Details from "@/app/components/dashboard/pitch/modals/steps/Details";
import Payment from "@/app/components/dashboard/pitch/modals/steps/Payment";
import Schedule from "@/app/components/dashboard/pitch/modals/steps/Schedule";
import Pricing from "@/app/components/dashboard/pitch/modals/steps/Pricing";

import { IoIosClose } from "react-icons/io";
import useFormContext from "@/app/context/Form";

export interface CreateGroundModalAction {
    type: "clear" | "set";
    field: keyof Ground | "*";
    value?: string | string[] | number | number[] | Ground;
};

function createGroundModalReducer(state: Ground, action: CreateGroundModalAction) {
    switch (action.type) {
        case "set":
            if (action.field === "*") {
                return action.value as Ground;
            }

            return {
                ...state,
                [action.field]: action.value,
            };

        case "clear":
            return ground();

        default:
            return state;
    }
}

export default function GroundModal({ id, isOpen, onClose } : { id: string | null, isOpen: boolean, onClose: () => void }) {
    const { data, setData } = useFormContext<Pitch>();
    const initialGround = id ? data.layout.grounds.find(g => g.id === id)! : ground();

    const [index, setIndex] = useState(0);
    const [state, dispatch] = useReducer(createGroundModalReducer, initialGround);

    const steps = [
        {
            label: id ? "Edit Ground" : "Ground Details",
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

    const { PITCH_SIZE, GROUND_SIZES } = defaults;

    const doesCollide = (
        x: number,
        y: number,
        w: number,
        h: number
    ) => {
        return data.layout.grounds.some(g => {
            return (
                x < g.x + g.w &&
                x + w > g.x &&
                y < g.y + g.h &&
                y + h > g.y
            );
        });
    };

    const findFreePoint = (size: GroundSize) => {
        const base = GROUND_SIZES[size];

        const w = base.width;
        const h = base.height;

        for (let y = 0; y <= PITCH_SIZE.rows - h; y++) {
            for (let x = 0; x <= PITCH_SIZE.columns - w; x++) {
                if (!doesCollide(x, y, w, h)) {
                    return { x, y, w, h };
                }
            }
        }

        return null;
    };

    const finish = () => {
        const target = state;
        const position = findFreePoint(target.size);

        if (!position) {
            alert("No available space for this ground size.");
            return;
        };

        let grounds: Ground[];

        if (id) {
            grounds = data.layout.grounds.map(g =>
                g.id === id ? state : g
            );
        } else {
            grounds = [...data.layout.grounds, { ...target, ...position }];
        }

        setData(prev => ({
            ...prev,
            layout: {
                ...prev.layout,
                grounds
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
