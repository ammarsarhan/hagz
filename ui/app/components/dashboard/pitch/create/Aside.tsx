import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import Logo from "@/app/components/base/Logo";
import Progress from "@/app/components/dashboard/pitch/create/Progress";
import config from "@/app/utils/framer/config";

import { FaCheck, FaChevronRight } from "react-icons/fa6";
import { LuLayoutDashboard } from "react-icons/lu";

export default function Aside() {
    const { step, index, steps, setIndex } = useFormContext();

    const handlePropagate = (target: number) => {
        if (target > index) return;
        setIndex(target);
    }

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
                        key={`text-${index}`}
                        variants={config.container}
                        transition={config.transition}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="flex flex-col gap-y-1 my-7"
                    >
                        <motion.h1 variants={config.item} className="text-xl font-semibold">
                            {step.title}
                        </motion.h1>
                        <motion.p variants={config.item} className="text-[0.85rem] text-gray-700">
                            {step.description}
                        </motion.p>
                    </motion.div>
                </AnimatePresence>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`steps-${index}`}
                        variants={config.container}
                        transition={config.transition}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="flex flex-col gap-y-4"
                    >
                        {steps.map((s, i) => {
                            const isActive = index >= i;
                            return (
                                <motion.div variants={config.item} className="flex items-center gap-x-2" key={i}>
                                    <div className={`rounded-full flex-center size-4 transition-colors ${isActive ? "bg-black" : "bg-linear-to-b from-gray-400 to-gray-300"}`}>
                                        {isActive && <div className="size-1.5 rounded-full bg-white"></div>}
                                    </div>
                                    <span className={`text-[0.85rem] transition-colors ${isActive ? "text-black font-medium" : "text-gray-400"}`}>
                                        {s.label}
                                    </span>
                                </motion.div>
                            )
                        })}
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="w-full flex flex-col gap-y-2">
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={`progress-card-${index}`}
                        variants={config.container}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="p-4 bg-gray-50 rounded-md shadow-sm text-center flex-center flex-col"
                    >
                        <motion.div variants={config.item}>
                            <LuLayoutDashboard className="size-8"/>
                        </motion.div>
                        <motion.div variants={config.item} className="flex flex-col gap-y-0.5 my-4">
                            <h1 className="text-sm font-medium">You&apos;re almost there!</h1>
                            <p className="text-gray-600 text-xxs">You&apos;re about five minutes away from being ready to receive bookings!</p>
                        </motion.div>
                        <motion.div variants={config.item} className="w-full">
                             <Progress containerWidth={256} index={index} steps={steps.length - 1}/>   
                        </motion.div>
                        <motion.div variants={config.item} className="flex flex-col text-xxs w-full mt-6">
                            <button onClick={() => handlePropagate(0)} className={`flex items-center justify-between border px-3 py-2 rounded-t-md border-gray-200/75 ${index >= 0 ? "hover:bg-gray-100" : "cursor-not-allowed!"} transition-all`}>
                                <div className="flex items-center gap-x-2">
                                    <div className="rounded-full size-4.5 flex-center bg-gray-200">
                                        {index > 0 && <FaCheck className="size-2.5"/>}
                                    </div>
                                    <span className={index === 0 ? "underline" : undefined}>Set up pitch details</span>
                                </div>
                                <FaChevronRight className="size-2.5"/>
                            </button>
                            <button onClick={() => handlePropagate(2)} className={`flex items-center justify-between border-x border-b px-3 py-2 border-gray-200/75 ${index >= 2 ? "hover:bg-gray-100" : "cursor-not-allowed!"} transition-all`}>
                                <div className="flex items-center gap-x-2">
                                    <div className="rounded-full size-4.5 flex-center bg-gray-200">
                                        {index > 2 && <FaCheck className="size-2.5"/>}
                                    </div>
                                    <span className={index === 2 ? "underline" : undefined}>Add pitch amenities</span>
                                </div>
                                <FaChevronRight className="size-2.5"/>
                            </button>
                            <button onClick={() => handlePropagate(3)} className={`flex items-center justify-between border-x border-b px-3 py-2 rounded-b-md border-gray-200/75 ${index >= 3 ? "hover:bg-gray-100" : "cursor-not-allowed!"} transition-all`}>
                                <div className="flex items-center gap-x-2">
                                    <div className="rounded-full size-4.5 flex-center bg-gray-200">
                                        {index > 3 && <FaCheck className="size-2.5"/>}
                                    </div>
                                    <span className={index === 3 ? "underline" : undefined}>Create pitch layout</span>
                                </div>
                                <FaChevronRight className="size-2.5"/>
                            </button>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.aside>
    )
}