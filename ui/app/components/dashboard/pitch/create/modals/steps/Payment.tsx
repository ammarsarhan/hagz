import { ActionDispatch } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Ground, groundPolicyDescriptions, groundPolicyOptions, paymentMethodOptions } from "@/app/utils/types/dashboard";
import { CreateGroundModalAction } from "@/app/components/dashboard/pitch/create/modals/Ground";
import { InputGroup } from "@/app/components/dashboard/Input";
import { DropdownGroup } from "@/app/components/dashboard/Dropdown";
import { MultiDropdownGroup } from "@/app/components/dashboard/MultiDropdown";

export default function Payment({ state, dispatch } : { state: Ground, dispatch: ActionDispatch<[action: CreateGroundModalAction]> }) {
    const { description, example } = groundPolicyDescriptions.find(g => g.value === state.policy)!;
    const allowsDeposit = state.paymentMethods.includes("CASH") && state.policy != "LENIENT";

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-y-4"
        >
            <div className="flex gap-x-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1"
                        key="base"
                    >
                        <InputGroup label={"Base Price"} onChange={(e) => dispatch({ type: "set", field: "basePrice", value: e.target.value })} type={"text"} placeholder={"Ground Price"} value={state.basePrice} className="flex-1 [&>span]:text-[0.8125rem] text-xxs"/>
                    </motion.div>
                    {
                        allowsDeposit &&
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1"
                            key="deposit"
                        >
                            <InputGroup label={"Deposit Fee"} onChange={(e) => dispatch({ type: "set", field: "depositFee", value: e.target.value })} type={"text"} placeholder={"Deposit Fee"} value={state.depositFee || ""} className="flex-1 [&>span]:text-[0.8125rem] text-xxs"/>
                        </motion.div>
                    }
                </AnimatePresence>
            </div>
            <div className="flex gap-x-4">
                <InputGroup label={"Peak Hour Surcharge"} onChange={(e) => dispatch({ type: "set", field: "peakPrice", value: e.target.value })} type={"text"} placeholder={"Peak Price"} value={state.peakPrice} className="flex-1 [&>span]:text-[0.8125rem] text-xxs"/>
                <InputGroup label={"Off-peak Hour Discount"} onChange={(e) => dispatch({ type: "set", field: "discountPrice", value: e.target.value })} type={"text"} placeholder={"Discount Price"} value={state.discountPrice} className="flex-1 [&>span]:text-[0.8125rem] text-xxs"/>
            </div>
            <MultiDropdownGroup label={"Payment Methods"} placeholder={"Select Methods"} value={state.paymentMethods} onChange={(value) => dispatch({ type: "set", field: "paymentMethods", value })} options={paymentMethodOptions} className="flex-1 [&>span]:text-[0.8125rem] text-xxs"/>
            <div className="flex flex-col gap-y-3">
                <DropdownGroup label={"Ground Policy"} placeholder={"Select Policy"} value={state.policy} onChange={(value) => dispatch({ type: "set", field: "policy", value })} options={groundPolicyOptions} className="flex-1 [&>span]:text-[0.8125rem] text-xxs"/>
                <p className="text-gray-700 text-xxs">{description}</p>
                <p className="text-gray-700 text-xxs">{example}</p>
            </div>
        </motion.div>
    )
}