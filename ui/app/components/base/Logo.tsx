import { IoMdFootball } from "react-icons/io";

export default function Logo({ variant = "primary", active = false } : { variant?: "primary" | "secondary" | "mono", active?: boolean }) {
    switch (variant) {
        case "primary":
            return (
                <div className={`rounded-md size-9 bg-primary text-black flex items-center justify-center ${active ? "hover:bg-primary/75 hover:text-black/75" : ""} transition-colors`}>
                    <IoMdFootball className="size-5.5" />
                </div>
            )
        case "secondary":
            return (
                <div className={`rounded-md size-9 bg-black text-primary flex items-center justify-center ${active ? "hover:bg-black/75 hover:text-primary/75" : ""} transition-colors`}>
                    <IoMdFootball className="size-5.5" />
                </div>
            )
        case "mono":
            return (
                <div className={`rounded-md size-9 bg-gray-200 text-black flex items-center justify-center ${active ? "hover:bg-gray-200/75 hover:text-black/75" : ""} transition-colors`}>
                    <IoMdFootball className="size-5.5" />
                </div>
            )
    }
}