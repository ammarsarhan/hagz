import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IoEye, IoEyeOff } from "react-icons/io5";

interface InputProps {
    className?: string;
    label?: string;
    error?: boolean;
    type: "text" | "password";
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

type InputGroupProps = Omit<InputProps, "error"> & { label: string, error?: string, description?: string };

export default function Input({ type, className, placeholder, value, error, onChange } : InputProps) {
    const [showPassword, setShowPassword] = useState(false);

    const base = `p-2 border ${error ? "border-red-600" : "border-transparent"} rounded-md text-[0.85rem] w-full bg-gray-200/75 hover:bg-gray-200/50 outline-none focus:border-black focus:bg-gray-50 transition-colors`;
    const isPassword = type === "password";
    const computedType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
        <div className={`relative ${className}`}>
            <input className={base} type={computedType} placeholder={placeholder} value={value} onChange={onChange}/>
            {
                isPassword &&
                <button type="button" className="absolute h-[calc(100%-2px)] px-2.5 my-px mx-px rounded-md bg-white right-0" onClick={() => setShowPassword(prev => !prev)}>
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

export function InputGroup({ className, type, label, placeholder, value, error, description, onChange } : InputGroupProps) {
    return (
        <div className={`flex flex-col gap-y-1.5 ${className}`}>
            <span className="text-sm">{label}</span>
            <Input error={!!error} type={type} placeholder={placeholder} value={value} onChange={onChange}/>
            <AnimatePresence mode="wait">   
                {
                    error ?
                    <motion.span 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-red-600"
                    >
                        {error}
                    </motion.span> :
                    description &&
                    <motion.span 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-gray-600"
                    >
                        {description}
                    </motion.span>              
                }
            </AnimatePresence>
        </div>
    )
}
