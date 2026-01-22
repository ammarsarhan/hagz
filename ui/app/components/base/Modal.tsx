import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

type OrientationType = "center" | "left" | "right";

interface ModalProps { 
    children: React.ReactNode;
    isOpen: boolean;
    className: string;
    onClose: () => void;
    orientation?: OrientationType;
}

export function Modal({ orientation = "center", className, children, isOpen, onClose } : ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    let base = "w-screen h-screen fixed top-0 left-0 z-99 bg-black/30 ";

    switch (orientation) {
        case "center":
            base += "flex-center ";
            break;
        case "left":
            base += "flex items-center justify-start ";
            break;
        case "right":
            base += "flex items-center justify-end ";
            break;
    }

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    return (
        <AnimatePresence>
            {
                isOpen &&
                <motion.div 
                    className={base}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <div ref={modalRef} className={className}>
                        {children}
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    )
}