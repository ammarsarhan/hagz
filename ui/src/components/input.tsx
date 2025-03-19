import { ReactNode } from "react"

interface InputGroupProps {
    label: string,
    placeholder: string,
    className?: string
}

interface InputProps {
    placeholder: string,
    className?: string
}

export default function Input({ placeholder, className }: InputProps) {
    let style = "w-full px-2 py-1 rounded-md border-[1px]";

    if (className) {
        style = style.concat(" ", className);
    }

    return (
        <input type="text" className={style} placeholder={placeholder}/>
    )
}

export function InputGroup({ label, placeholder, className }: InputGroupProps) {
    return (
        <div className="w-full">
            <span className="block text-sm mb-1">{label}</span>
            <Input placeholder={placeholder} className={className}/>
        </div>
    )
}

export function InputGroupContainer({ children, className } : { children: ReactNode, className?: string }) {
    let style = "flex items-center gap-x-6 w-full";
    
    if (className) {
        style = style.concat(" ", className);
    }

    return (
        <div className={style}>
            { children }
        </div>
    )
}