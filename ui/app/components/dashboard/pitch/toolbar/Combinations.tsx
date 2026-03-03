import { motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import { Pitch } from "@/app/utils/types/dashboard";

import { TbLayout2 } from "react-icons/tb";

export default function Combinations() {
    const { data } = useFormContext<Pitch>();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex-center"
        >
            {
                data.layout.grounds.length <= 0 ?
                <div className="flex-center flex-col gap-y-0.5 text-center mx-2">
                    <TbLayout2 className="size-12 my-3"/>
                    <h2 className="font-medium text-[0.95rem]">You do not have enough grounds yet.</h2>
                    <p className="text-[0.785rem] text-gray-600">
                        You need at least two combinable grounds within your pitch to create a combination.
                    </p>
                </div> : 
                <div>
                    
                </div>
            }
        </motion.div>
    )
}