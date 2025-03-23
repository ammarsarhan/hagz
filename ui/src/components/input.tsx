import { ChangeEvent, ReactNode } from "react"

interface InputGroupProps {
    label: string,
    placeholder: string,
    value: string,
    onChange: (e: ChangeEvent<HTMLInputElement>) => void,
    type?: string,
    className?: string
    onClear?: () => void
}

interface InputProps {
    placeholder: string,
    value: string,
    onChange: (e: ChangeEvent<HTMLInputElement>) => void,
    type?: string,
    className?: string
}

interface InputRangeProps {
    minimum: number, 
    maximum: number, 
    minValue: number, 
    maxValue: number, 
    onMinChange: (e: ChangeEvent<HTMLInputElement>) => void,
    onMaxChange: (e: ChangeEvent<HTMLInputElement>) => void,
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

export function InputGroup({ label, placeholder, value, onChange, type = "text", className, onClear }: InputGroupProps) {
    return (
        <div className="w-full">
            {
                onClear ?
                <div className="flex items-center justify-between gap-x-8">
                    <span className="block text-sm mb-1">{label}</span>
                    <button className="text-blue-800 text-xs mr-1 hover:underline" onClick={onClear}>Clear</button>
                </div> :
                <span className="block text-sm mb-1">{label}</span>
            }
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

export function InputRange({ minimum, maximum, minValue, onMinChange, maxValue, onMaxChange, className } : InputRangeProps) {
    return (
        <div className={`flex flex-col w-full ${className}`}>
            <div className="relative">
                <input type="range" value={minValue} onChange={onMinChange} min={minimum} max={maxValue} className="outline-none appearance-none h-0.5 w-full pointer-events-none bg-gray-300 absolute"/>
                <input type="range" value={maxValue} onChange={onMaxChange} min={minimum} max={maximum} className="outline-none appearance-none h-0.5 w-full pointer-events-none absolute"/>
            </div>
        </div>
    )
}