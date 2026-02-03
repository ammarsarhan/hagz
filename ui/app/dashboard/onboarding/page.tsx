"use client";

import { AnimatePresence, motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import Aside from "@/app/components/dashboard/pitch/create/Aside";
import Button from "@/app/components/base/Button";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

export default function Onboarding() {
    const { step, previous, next } = useFormContext();

    return (
        <div className="h-screen relative w-full flex bg-gray-100">
            <Aside/>
            <div className="w-full flex-center flex-col flex-1 p-4 bg-gray-50">
                <AnimatePresence mode="wait">
                    {step.component}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-x-3 w-3xl"
                        key="toolbar"
                    >
                        <Button variant="outline" onClick={previous}>
                            <FaChevronLeft className="size-3"/>
                            <span>Previous</span> 
                        </Button>
                        <Button variant="mono" onClick={next}>
                            <span>Next</span> 
                            <FaChevronRight className="size-3"/>
                        </Button>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}