"use client";

import { AnimatePresence, motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import Button from "@/app/components/base/Button";
import Aside from "@/app/components/dashboard/pitch/create/Aside";
import Toolbar from "@/app/components/dashboard/pitch/create/toolbar/Toolbar";

import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

export default function Onboarding() {
    const { step, previous, next } = useFormContext();

    const isBuilder = step.label === "Grounds";
    const isLast = step.label === "Summary";

    return (
        <div className="h-screen relative w-full flex bg-gray-100">
            <Aside/>
            <div className={`p-4 bg-gray-50 ${isBuilder ? "flex flex-1 h-full w-[calc(100vw-40rem)]" : "flex-center flex-col flex-1 w-full"}`}>
                <AnimatePresence mode="wait">
                    {step.component}
                </AnimatePresence>
                {
                    !isBuilder && !isLast &&
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-x-3 w-3xl"
                        key="navigation"
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
                }
            </div>
            <AnimatePresence mode="wait">
                {
                    isBuilder &&
                    <Toolbar/>
                }
            </AnimatePresence>
        </div>
    )
}