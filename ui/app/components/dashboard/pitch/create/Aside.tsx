import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import Logo from "@/app/components/base/Logo";

import config from "@/app/utils/framer/config";

export default function Aside() {
    const { step, index, steps } = useFormContext();

    return (
        <motion.aside 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="w-xs hidden lg:flex flex-col justify-between p-4 bg-gray-100"
        >
            <div>
                <Link href="/" className="w-fit!">
                    <Logo active/>
                </Link>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={index}
                        variants={config.container}
                        transition={config.transition}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="flex flex-col gap-y-1 my-6"
                    >
                        <motion.h1
                            variants={config.item}
                            className="text-xl font-semibold"
                        >
                            {step.title}
                        </motion.h1>
                        <motion.p
                            variants={config.item}
                            className="text-sm"
                        >
                            {step.description}
                        </motion.p>
                    </motion.div>
                </AnimatePresence>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={index}
                        variants={config.container}
                        transition={config.transition}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="flex flex-col gap-y-3.5"
                    >
                        {
                            steps.map((s, i) => {
                                const isActive = index >= i;
                                
                                return (
                                    <motion.div 
                                        variants={config.item} 
                                        className="flex items-center gap-x-2" 
                                        key={i}
                                    >
                                        <div className={`rounded-full flex-center size-4 transition-colors ${isActive ? "bg-black" : "bg-gray-400"}`}>
                                            {
                                                isActive &&
                                                <div className="size-1.5 rounded-full bg-white"></div>
                                            }
                                        </div>
                                        <span className={`font-medium text-sm transition-colors ${isActive ? "text-black" : "text-gray-400"}`}>
                                            {s.label}
                                        </span>
                                    </motion.div>
                                )
                            })
                        }
                    </motion.div>
                </AnimatePresence>
            </div>
            <span className="text-gray-600 text-xs">© Hagz 2026</span>
        </motion.aside>
    )
}