import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

export default function NotificationsModal() {
    const [open, setOpen] = useState(true);

    return null;

    return (
        <AnimatePresence>
            {
                open &&
                <motion.div className="absolute mt-2 bg-white z-999 p-4 border-[1px] border-gray-200 rounded-md w-96 right-0">
                    <div className="flex items-center justify-between">

                    </div>
                </motion.div>
            }
        </AnimatePresence>
    )
}