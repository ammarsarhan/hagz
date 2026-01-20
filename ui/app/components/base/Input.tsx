import { useState } from "react";
import { IoEye, IoEyeOff } from "react-icons/io5";

interface InputProps {
    className?: string;
    label?: string;
    type: "text" | "password";
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

type InputGroupProps = InputProps & { label: string };

export default function Input({ type, className, placeholder, value, onChange } : InputProps) {
    const [showPassword, setShowPassword] = useState(false);

    const base = "p-2 border border-gray-200 rounded-md text-sm w-full bg-white outline-none focus:border-secondary";
    const isPassword = type === "password";
    const computedType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
        <div className={`relative ${className}`}>
            <input className={base} type={computedType} placeholder={placeholder} value={value} onChange={onChange}/>
            {
                isPassword &&
                <button className="absolute h-[calc(100%-2px)] px-2.5 my-px mx-px rounded-md bg-white right-0" onClick={() => setShowPassword(prev => !prev)}>
                    {
                        showPassword ?
                        <IoEyeOff className="size-4 text-gray-400"/> :
                        <IoEye className="size-4 text-gray-400"/>
                    }
                </button>
            }
        </div>
    )
}

export function InputGroup({ className, type, label, placeholder, value, onChange } : InputGroupProps) {
    return (
        <div className={`flex flex-col gap-y-1.5 ${className}`}>
            <span className="text-xxs">{label}</span>
            <Input type={type} placeholder={placeholder} value={value} onChange={onChange}/>
        </div>
    )
}