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
    let style = "w-full px-2 rounded-md border-[1px]";

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
            <span>{label}</span>
            <Input placeholder={placeholder} className={className}/>
        </div>
    )
}

export function InputGroupContainer({ children } : { children: ReactNode }) {
    return (
        <div className="flex items-center gap-x-6">
            { children }
        </div>
    )
}