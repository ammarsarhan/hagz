import { AnimatePresence, motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import Button from "@/app/components/base/Button";
import Uploader from "@/app/components/dashboard/Uploader";
import { InputGroup } from "@/app/components/dashboard/Input";
import { TextAreaGroup } from "@/app/components/dashboard/TextArea";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { pitchDetailsSchema } from "@/app/schemas/pitch";
import parseErrors from "@/app/utils/schema";

export default function Details() {
    const { data, setData, errors, setErrors, next } = useFormContext();

    const handleNext = () => {
        const parsed = pitchDetailsSchema.safeParse(data);

        if (!parsed.success) {
            const errors = parseErrors(parsed.error.issues);
            setErrors(errors);
            return;
        };

        next();
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[calc(100vh-2rem)] flex-center flex-col gap-y-6 w-2xl"
            >
                <div className="flex flex-col gap-y-4 w-full">
                    <div className="flex gap-x-4">
                        <InputGroup error={errors["name"]} label={"Pitch Name"} onChange={(e) => setData({ ...data, name: e.target.value })} type={"text"} placeholder={"Pitch Name"} value={data.name} className="flex-1"/>
                        <InputGroup error={errors["taxId"]} label={"Tax Identification Number"} onChange={(e) => setData({ ...data, taxId: e.target.value })} type={"text"} placeholder={"Tax ID"} value={data.taxId} className="flex-1"/>
                    </div>
                    <TextAreaGroup error={errors["description"]} label={"Pitch Description"} onChange={(e) => setData({ ...data, description: e.target.value })} placeholder={"Pitch Description"} value={data.description} resize={false}/>
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
                                    className="text-xs text-red-600"
                                >
                                    {errors["images"]}
                                </motion.p> :
                                <motion.p 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-xs text-gray-600"
                                >
                                    We need between 3 and 10 high quality images that show your pitch under its best light.
                                </motion.p>
                            }
                        </AnimatePresence>
                    </div>
                    <Uploader/>
                </div>
                <div className="w-full">
                    <InputGroup error={errors["googleMapsLink"]} label={"Google Maps Link"} onChange={(e) => setData({ ...data, googleMapsLink: e.target.value })} type={"text"} placeholder={"Link"} value={data.googleMapsLink} className="flex-1" description="Adding a Google Maps link helps us index your pitch better, making you appear higher in search results."/>
                </div>
            </motion.div>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-x-3 w-2xl"
            >
                <Button variant="outline" disabled>
                    <FaChevronLeft className="size-3"/>
                    <span>Previous</span> 
                </Button>
                <Button variant="mono" onClick={handleNext}>
                    <span>Next</span> 
                    <FaChevronRight className="size-3"/>
                </Button>
            </motion.div>
        </>
    )
}