import { AnimatePresence, motion } from "framer-motion";

interface TextAreaProps {
    className?: string;
    label?: string;
    error?: boolean;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    rows?: number;
    resize?: boolean;
}

type TextAreaGroupProps = Omit<TextAreaProps, "error"> & { 
    label: string;
    error?: string;
    description?: string;
};

export default function TextArea({ 
    className, 
    placeholder, 
    value, 
    error, 
    onChange,
    rows = 4,
    resize = true,
}: TextAreaProps) {
    const base = `p-2 border ${error ? "border-red-600" : "border-transparent"} ${resize ? "resize-y" : "resize-none"} rounded-md text-[0.85rem] w-full bg-gray-200/50 outline-none focus:border-black focus:bg-gray-50 transition-colors`;

    return (
        <textarea 
            className={`${base} ${className}`}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            rows={rows}
        />
    );
}

export function TextAreaGroup({ 
    className, 
    label, 
    placeholder, 
    value, 
    error, 
    description, 
    onChange,
    rows,
    resize
}: TextAreaGroupProps) {
    return (
        <div className={`flex flex-col gap-y-1.5 ${className}`}>
            <span className="text-sm">{label}</span>
            <TextArea 
                error={!!error}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                rows={rows}
                resize={resize}
            />
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
    );
}