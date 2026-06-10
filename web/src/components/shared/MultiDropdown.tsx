import { useState, useRef, useEffect, type ReactNode } from "react";
import { TbCheck, TbChevronDown, TbX } from "react-icons/tb";

export interface DropdownOption {
    value: string;
    label: string;
    icon?: ReactNode;
}

const baseField =
    "w-full text-sm bg-white border px-2 py-1.5 rounded-md cursor-pointer select-none flex items-center justify-between gap-2";

function fieldClass(open: boolean, error?: string) {
    const border = error
        ? "border-red-500 outline-none"
        : open
        ? "border-primary-muted outline outline-2 outline-primary-muted"
        : "border-gray-200 outline-none";

    return `${baseField} ${border}`;
}

function useDropdown() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onMouse(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
        }

        document.addEventListener("mousedown", onMouse);
        return () => document.removeEventListener("mousedown", onMouse);
    }, []);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        };

        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    return { open, setOpen, ref };
}

interface MultiDropdownProps {
    options: DropdownOption[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    className?: string;
    label?: string;
    error?: string;
    maxVisible?: number;
}

export default function MultiDropdown({
    options,
    value,
    onChange,
    placeholder = "Select options",
    className,
    label,
    error,
    maxVisible = 3,
}: MultiDropdownProps) {
    const { open, setOpen, ref } = useDropdown();

    function toggle(optValue: string) {
        if (value.includes(optValue)) {
            onChange(value.filter((v) => v !== optValue));
        } else {
            onChange([...value, optValue]);
        }
    }

    function remove(optValue: string, e: React.MouseEvent) {
        e.stopPropagation();
        onChange(value.filter((v) => v !== optValue));
    }

    const selectedOptions = options.filter((o) => value.includes(o.value));

    const visibleTags = selectedOptions.slice(0, maxVisible);
    const overflow = selectedOptions.length - maxVisible;

    return (
        <div className={`flex flex-col gap-y-1.5 ${className ?? ""}`}>
            {label && <span className="text-base">{label}</span>}
            <div className="relative" ref={ref}>
                <div
                    role="combobox"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-multiselectable="true"
                    tabIndex={0}
                    className={`${fieldClass(open, error)}`}
                    onClick={() => setOpen((p) => !p)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpen((p) => !p);
                        }
                    }}
                >
                <span className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {selectedOptions.length === 0 ? (
                    <span className="text-gray-400">{placeholder}</span>
                    ) : (
                    <>
                        {visibleTags.map((opt) => (
                        <span
                            key={opt.value}
                            className="inline-flex items-center gap-1 px-1.5 py-0.75 rounded bg-gray-100 text-gray-700 text-sm leading-none"
                        >
                            {opt.icon && (
                                <span className="text-gray-500 shrink-0">{opt.icon}</span>
                            )}
                            <span className="truncate max-w-30">{opt.label}</span>
                            <button
                                type="button"
                                tabIndex={-1}
                                className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                                onClick={(e) => remove(opt.value, e)}
                                aria-label={`Remove ${opt.label}`}
                            >
                                <TbX size={12} />
                            </button>
                        </span>
                        ))}
                        {overflow > 0 && (
                        <span className="text-xs text-gray-400 shrink-0">
                            +{overflow} more
                        </span>
                        )}
                    </>
                    )}
                </span>
                <TbChevronDown
                    size={16}
                    className={`shrink-0 text-gray-400 transition-transform duration-200 ${
                    open ? "rotate-180" : "rotate-0"
                    }`}
                />
                </div>
                {open && (
                <ul
                    role="listbox"
                    aria-multiselectable="true"
                    className="absolute z-50 top-full mt-1 left-0 w-full bg-white border border-gray-200 rounded-md shadow-md overflow-hidden py-1"
                >
                    {options.map((opt) => {
                    const isSelected = value.includes(opt.value);
                    return (
                        <li
                            key={opt.value}
                            role="option"
                            aria-selected={isSelected}
                            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm transition-colors ${
                                isSelected
                                ? "bg-gray-50 text-black"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                            onClick={() => toggle(opt.value)}
                        >
                            {opt.icon && (
                                <span className="shrink-0 text-gray-500">{opt.icon}</span>
                            )}
                            <span className="flex-1 truncate">{opt.label}</span>
                            {isSelected && (
                                <TbCheck size={14} className="shrink-0 text-black" />
                            )}
                        </li>
                    );
                    })}
                </ul>
                )}
            </div>
            {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
    );
}