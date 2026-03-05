import { ActionDispatch } from "react";
import { motion } from "framer-motion";

import { Ground, GroundSize, groundSizeOptions, groundSportOptions, groundSurfaceOptions } from "@/app/utils/types/dashboard";
import { CreateGroundModalAction } from "@/app/components/dashboard/pitch/modals/Ground";
import { InputGroup } from "@/app/components/dashboard/Input";
import { TextAreaGroup } from "@/app/components/dashboard/TextArea";
import { DropdownGroup } from "@/app/components/dashboard/Dropdown";
import { defaults } from "@/app/utils/dashboard/config";

export default function Details({ state, dispatch } : { state: Ground, dispatch: ActionDispatch<[action: CreateGroundModalAction]> }) {
    const handleUpdateSize = (size: GroundSize) => {
        const { width, height } = defaults.GROUND_SIZES[size];

        dispatch({ type: "set", field: "size", value: size });
        dispatch({ type: "set", field: "w", value: width });
        dispatch({ type: "set", field: "h", value: height });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-y-4 w-full"
        >
            <InputGroup label={"Ground Name"} onChange={(e) => dispatch({ type: "set", field: "name", value: e.target.value })} type={"text"} placeholder={"Ground Name"} value={state.name} className="flex-1 [&>span]:text-[0.8125rem] text-xxs"/>
            <DropdownGroup label={"Sport"} placeholder={"Select Sport"} value={state.sport} onChange={(value) => dispatch({ type: "set", field: "sport", value })} options={groundSportOptions} className="flex-1 [&>span]:text-[0.8125rem] text-xxs"/>
            <div className="flex gap-x-4">
                <DropdownGroup label={"Ground Size"} placeholder={"Select Size"} value={state.size} onChange={(value) => handleUpdateSize(value as GroundSize)} options={groundSizeOptions} className="flex-1 [&>span]:text-[0.8125rem] text-xxs"/>
                <DropdownGroup label={"Ground Surface"} placeholder={"Select Surface"} value={state.surface} onChange={(value) => dispatch({ type: "set", field: "surface", value })} options={groundSurfaceOptions} className="flex-1 [&>span]:text-[0.8125rem] text-xxs"/>
            </div>
            <TextAreaGroup label={"Additional Description"} onChange={(e) => dispatch({ type: "set", field: "description", value: e.target.value })} placeholder={"Description"} value={state.description} resize={false} className="[&>span]:text-[0.8125rem] text-xxs"/>
        </motion.div>
    )
}