import { SyntheticEvent } from "react";

type ToggleVariant = "primary" | "secondary" | "mono" | "outline";

interface ToggleProps {
    isOpen: boolean;
    setIsOpen: () => void;
    variant: ToggleVariant
}

export default function Toggle({ isOpen, setIsOpen, variant } : ToggleProps) {
    const base = `w-10 h-5 rounded-full relative transition-all`;

    const handleSwitch = (e: SyntheticEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setIsOpen();
    };
    
    switch (variant) {
        case "primary":
            return (
                <button onClick={handleSwitch} className={`${isOpen ? "bg-black hover:bg-black/90" : "bg-gray-200 hover:bg-gray-200/90"} border-transparent ${base}`}>
                    <div className={`absolute top-1/2 -translate-y-1/2 size-3 rounded-full ${isOpen ? "left-6 bg-linear-to-b from-gray-300 to-gray-200" : "left-1 bg-white"} transition-all`}></div>
                </button>
            )
        case "mono":
            return (
                <button onClick={handleSwitch} className={`${isOpen ? "bg-black hover:bg-black/90" : "bg-gray-200 hover:bg-gray-200/90"} border-transparent ${base}`}>
                    <div className={`absolute top-1/2 -translate-y-1/2 size-3 rounded-full ${isOpen ? "left-6 bg-gray-500" : "left-1 bg-white"} transition-all`}></div>
                </button>
            )
        case "outline":
            return (
                <button onClick={handleSwitch} className={`${isOpen ? "bg-black hover:bg-black/90" : "bg-gray-200 hover:bg-gray-200/90"} border-transparent ${base}`}>
                    <div className={`absolute top-1/2 -translate-y-1/2 size-3 rounded-full ${isOpen ? "left-6 bg-primary" : "left-1 bg-white"} transition-all`}></div>
                </button>
            )
    }
}