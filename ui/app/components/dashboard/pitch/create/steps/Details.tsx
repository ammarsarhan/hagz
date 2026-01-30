import { motion } from "framer-motion";
import useFormContext from "@/app/context/Form";

export default function Details() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full w-full flex-center"
        >

        </motion.div>
    )
}