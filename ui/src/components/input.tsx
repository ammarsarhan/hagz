import { ChangeEvent, ReactNode } from "react"

interface InputGroupProps {
    label: string,
    placeholder: string,
    value: string,
    onChange: (e: ChangeEvent<HTMLInputElement>) => void,
    type?: string,
    className?: string
}

interface InputProps {
    placeholder: string,
    value: string,
    onChange: (e: ChangeEvent<HTMLInputElement>) => void,
    type?: string,
    className?: string
}

export default function Input({ placeholder, className, value, type = "text", onChange }: InputProps) {
    let style = "w-full px-3 py-1 rounded-md border-[1px]";

    if (className) {
        style = style.concat(" ", className);
    }

    return (
        <input type={type} className={style} placeholder={placeholder} value={value} onChange={onChange}/>
    )
}

export function InputGroup({ label, placeholder, value, onChange, type = "text", className }: InputGroupProps) {
    return (
        <div className="w-full">
            <span className="block text-sm mb-1">{label}</span>
            <Input placeholder={placeholder} className={className} value={value} type={type} onChange={onChange}/>
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