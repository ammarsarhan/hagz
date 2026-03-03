import { motion } from "framer-motion";

export default function Progress({ containerWidth, index, steps }: { containerWidth: number, index: number, steps: number }) {
    const itemsLength = Math.max(8, Math.floor(containerWidth / 8));
    const traverseLimit = itemsLength * (index / steps);

    const items = Array(itemsLength).fill(0).map((_, i) => ({
        traversed: i < traverseLimit
    }));

    return (
        <div className="w-full flex items-center justify-between h-6">
            {items.map(({ traversed }, i) => {
                const ratio = i / (itemsLength - 1);
                const hue = traversed ? Math.round(72 + Math.pow(ratio, 2.5) * 73) : 0;
                
                const activeColor = `hsl(${hue}, 100%, 45%)`;
                const inactiveColor = "#e5e7eb";

                return (
                    <motion.div
                        key={i}
                        initial={false}
                        animate={{
                            height: `100%`,
                            backgroundColor: traversed ? activeColor : inactiveColor,
                        }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="w-1 rounded-full"
                    />
                );
            })}
        </div>
    );
}