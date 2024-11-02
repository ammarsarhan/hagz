import { ReactNode } from "react"

interface ButtonProps {
    variant: string,
    children?: ReactNode,
    className?: string,
    style?: object
    type?: "submit" | "reset" | "button" | undefined
    onClick?: () => void,
}

export default function Button ({ variant, onClick, children, className, style, type }: ButtonProps) {
    let buttonStyle = "px-6 py-3 rounded-full text-sm hover:bg-opacity-90 transition-all ";

    switch (variant) {
        case "primary":
            buttonStyle += "border-[1px] border-light-gray text-primary-black hover:bg-gray-50";
            break;
        case "secondary":
            buttonStyle += "border-[1px] border-primary-black bg-primary-black text-white";
            break;
        case "pending":
            buttonStyle += "border-[1px] bg-gray-100 text-black cursor-wait hover:!bg-opacity-100";
            break;
        case "disabled":
            buttonStyle += "border-[1px] bg-light-gray text-black cursor-auto";
            break;
        case "color":
            buttonStyle += "border-[1px] border-primary-black bg-primary-green text-white";
            break;
    }

    className && (buttonStyle += ` ${className}`);
    return (
        <button 
            type={type} 
            onClick={onClick} 
            className={buttonStyle} 
            disabled={variant === "disabled" || variant === "pending"} 
            style={style}>
                {variant === "pending" ? "Loading" : children}
        </button>
    )
}