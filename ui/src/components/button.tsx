import { ReactNode } from "react";

interface ButtonProps {
    variant: "Primary" | "Secondary" | "Outline" | "Mono" | "None"
    children: ReactNode

}

export default function Button({ children, variant } : ButtonProps) {
    let style = "";

    switch (variant) {
        case "Primary":
            style += ""
            break;
        case "Secondary":
            style += ""
            break;
        case "Outline":
            style += ""
            break;
        case "Mono":
            style += ""
            break;
    }

    return (
        <button className={style}>
            {children}
        </button>
    )
}