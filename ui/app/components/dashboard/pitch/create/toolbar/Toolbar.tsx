import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Grounds from "@/app/components/dashboard/pitch/create/toolbar/Grounds";
import Combinations from "@/app/components/dashboard/pitch/create/toolbar/Combinations";

export default function Toolbar() {
    const [isGroundsOpen, setIsGroundsOpen] = useState(true);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-xs bg-gray-100 p-4"
            key="builder"
        >
            <div className="flex items-center w-full border-b border-gray-200 h-8.5">
                <button className="w-full flex-1 flex-center" onClick={() => setIsGroundsOpen(true)}>
                    <span className={`${isGroundsOpen ? "text-secondary border-secondary" : "text-gray-500 border-transparent"} font-medium text-xxs border-b-[1.5px] py-1.5 px-2 transition-all`}>Grounds</span>
                </button>
                <button className="w-full flex-1 flex-center" onClick={() => setIsGroundsOpen(false)}>
                    <span className={`${!isGroundsOpen ? "text-secondary border-secondary" : "text-gray-500 border-transparent"} font-medium text-xxs border-b-[1.5px] py-1.5 px-2 transition-all`}>Combinations</span>
                </button>
            </div>
            <div className="h-[calc(100%-4rem)] flex-1">
                <AnimatePresence>
                    {
                        isGroundsOpen ? <Grounds/> : <Combinations/>
                    }
                </AnimatePresence>
            </div>
        </motion.div>
    )
}