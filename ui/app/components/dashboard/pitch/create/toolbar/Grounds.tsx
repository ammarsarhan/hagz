import { useState } from "react";
import { motion } from "framer-motion";

import Button from "@/app/components/base/Button";
import useFormContext from "@/app/context/Form";
import GroundModal from "@/app/components/dashboard/pitch/create/modals/Ground";
import { Pitch } from "@/app/utils/types/dashboard";

import { TbArtboard } from "react-icons/tb";

export default function Grounds() {
    const { data } = useFormContext<Pitch>();
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <GroundModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}/>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex-center"
            >
                {
                    data.layout.grounds.length <= 0 ?
                    <div className="flex-center flex-col gap-y-0.5 text-center mx-2">
                        <TbArtboard className="size-12 my-3"/>
                        <h2 className="font-medium text-[0.95rem]">You do not have any grounds yet.</h2>
                        <p className="text-[0.785rem] text-gray-600">
                            You need at least one ground within your pitch to finalize the creation process.
                        </p>
                        <Button className="my-4 font-medium text-xs!" variant="mono" onClick={() => setIsModalOpen(true)}>Add Ground</Button>
                    </div> : 
                    <div>
                        
                    </div>
                }
            </motion.div>
        </>
    )
}