"use client";

import { AnimatePresence } from "framer-motion";

import useFormContext from "@/app/context/Form";
import Aside from "@/app/components/dashboard/pitch/create/Aside";

export default function Onboarding() {
    const { step } = useFormContext();

    return (
        <div className="h-screen relative w-full flex bg-gray-100">
            <Aside/>
            <div className="w-full flex-center flex-col flex-1 p-4 bg-gray-50">
                <AnimatePresence mode="wait">
                    {step.component}
                </AnimatePresence>
            </div>
        </div>
    )
}