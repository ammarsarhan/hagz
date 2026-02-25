import { AnimatePresence, motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import Uploader from "@/app/components/dashboard/Uploader";
import { InputGroup } from "@/app/components/dashboard/Input";
import { TextAreaGroup } from "@/app/components/dashboard/TextArea";
import { Pitch } from "@/app/utils/types/dashboard";

export default function Details() {
    const { data, setData, errors } = useFormContext<Pitch>();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-[calc(100vh-2rem)] flex-center flex-col gap-y-6 w-3xl"
        >
            <div className="flex flex-col gap-y-4 w-full">
                <div className="flex gap-x-4">
                    <InputGroup error={errors["name"]} label={"Pitch Name"} onChange={(e) => setData(prev => ({ ...prev, name: e.target.value }))} type={"text"} placeholder={"Pitch Name"} value={data.name} className="flex-1"/>
                    <InputGroup error={errors["taxId"]} label={"Tax Identification Number"} onChange={(e) => setData(prev => ({ ...prev, taxId: e.target.value }))} type={"text"} placeholder={"Tax ID"} value={data.taxId} className="flex-1"/>
                </div>
                <TextAreaGroup error={errors["description"]} label={"Pitch Description"} onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))} placeholder={"Pitch Description"} value={data.description} resize={false}/>
            </div>
            <div className="flex flex-col gap-y-4 w-full">
                <div>
                    <span className="text-sm">Pitch Images</span>
                    <AnimatePresence mode="wait">
                        {
                            errors["images"] ?
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-xxs text-red-600"
                            >
                                {errors["images"]}
                            </motion.p> :
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-xxs text-gray-600"
                            >
                                We need between 3 and 10 high quality images that show your pitch under its best light.
                            </motion.p>
                        }
                    </AnimatePresence>
                </div>
                <Uploader/>
            </div>
        </motion.div>
    )
}