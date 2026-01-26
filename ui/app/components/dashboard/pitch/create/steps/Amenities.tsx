import { motion } from "framer-motion";

export default function Amenities() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            
        </motion.div>
    )
}