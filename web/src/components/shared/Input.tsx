import type { ChangeEvent, HTMLInputTypeAttribute } from "react";

type ExtendedInputType = HTMLInputTypeAttribute | "phone";

interface InputProps { 
    value: string, 
    onChange: (e: ChangeEvent<HTMLInputElement>) => void, 
    placeholder: string,
    type?: ExtendedInputType, 
    className?: string,
    label?: string,
    error?: string
};

export default function Input({ type = "text", value, onChange, placeholder, className, label, error } : InputProps) {
    let base = `w-full text-base bg-white border px-2 py-1.5 rounded-md ${error ? "border-red-500 outline-none" : "border-gray-200 outline-primary-muted"} ${className}`;

    if (type === "phone") {
        base += " rounded-l-none";
    }

    return (
        <div className="flex flex-col gap-y-1.5">
            {
                label &&
                <span className="text-base">{label}</span>
            }
            <div className="flex w-full">
                {
                    type === "phone" &&
                    <div className={`select-none cursor-not-allowed flex-center text-sm bg-white rounded-md rounded-r-none px-2 border border-r-transparent ${error ? "border-red-500" : "border-gray-200"}`}>
                        +20
                    </div>
                }
                <input type={type} value={value} placeholder={placeholder} onChange={onChange} className={base}/>
            </div>
            {
                error &&
                <span className="text-xs text-red-500">{error}</span>
            }
        </div>
    )
}