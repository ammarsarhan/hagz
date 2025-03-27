import { ChangeEvent, ReactNode } from "react"

interface InputGroupProps {
    label: string,
    placeholder: string,
    value: string,
    onChange: (e: ChangeEvent<HTMLInputElement>) => void,
    type?: string,
    className?: string
    min?: string,
    max?: string,
    onClear?: () => void
}

interface InputProps {
    placeholder: string,
    value: string,
    onChange: (e: ChangeEvent<HTMLInputElement>) => void,
    type?: string,
    min?: string,
    max?: string,
    className?: string
}

export default function Input({ placeholder, className, value, type = "text", onChange, min, max }: InputProps) {
    let style = "w-full py-1 border-b-[1px] outline-none";

    if (className) {
        style = style.concat(" ", className);
    }

    return (
        <input type={type} className={style} placeholder={placeholder} value={value} onChange={onChange} min={min} max={max}/>
    )
}

export function InputGroup({ label, placeholder, value, min, max, onChange, type = "text", className, onClear }: InputGroupProps) {
    return (
        <div className="w-full">
            {
                onClear ?
                <div className="flex items-center justify-between gap-x-8">
                    <span className="block text-sm mb-1 text-gray-500">{label}</span>
                    <button className="text-blue-800 text-xs mr-1 hover:underline" onClick={onClear}>Clear</button>
                </div> :
                <span className="block text-sm mb-1 text-gray-500">{label}</span>
            }
            <Input placeholder={placeholder} className={className} value={value} type={type} onChange={onChange} min={min} max={max}/>
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
