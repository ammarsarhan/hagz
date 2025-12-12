import { BillingMethod } from "@/app/utils/types/pitch";
import Link from "next/link";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { FaCheck, FaChevronDown } from "react-icons/fa6";

export default function Input({
  label,
  placeholder,
  description,
  required = false,
  value,
  onChange,
  error,
  unit,
  className,
  link,
  ...props
}: {
  label?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  error?: string;
  unit?: string;
  className?: string;
  link?: { title: string, href: string }
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-y-2 w-full">
      {
        label &&
        <label className="flex items-center gap-x-8 justify-between">
          <div>
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </div>
          {link && <Link href={link.href} className="text-blue-700 hover:underline" target="_blank">{link.title}</Link>}
        </label>
      }
      <div className="w-full relative">
        <input
          type="text"
          placeholder={placeholder}
          className={`border-[1px] w-full p-2 rounded-md ${error ? "border-red-500" : "border-gray-200"} ${className}`}
          value={value ?? ""}
          onChange={onChange}
          {...props}
        />
        {unit && 
          <div className="absolute top-1/2 -translate-y-1/2 right-2 bg-white pl-1 py-1">
            <span className="text-xs">{unit}</span>
          </div>
        }
      </div>
      {!error && description && <p className="text-gray-500 text-xs">{description}</p>}
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}


type Opt = { value: string; label: string };

export function Dropdown({
  label,
  options,
  required = false,
  description,
  value,
  onChange,
  wrapperStyle,
  className,
}: {
  label?: string;
  options: Opt[];
  required?: boolean;
  description?: string;
  className?: string;
  wrapperStyle?: CSSProperties;
  value?: string;
  onChange?: ((e: React.ChangeEvent<HTMLSelectElement>) => void);
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-y-2 w-full" style={wrapperStyle} ref={wrapperRef}>
      {label && (
        <span className="font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      )}

      <div className="relative w-full bg-white">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`cursor-pointer w-full border border-gray-200 rounded-md p-2 flex justify-between items-center text-left hover:border-gray-300 focus:ring-2 focus:ring-blue-200 ${className}`}
        >
          <span className="truncate">
            {selected?.label || "Select an option"}
          </span>
          <FaChevronDown
            className={`text-gray-500 size-3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto z-10">
            {options.length > 0 ? (
              options.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    // call the helper which will call the provided onChange appropriately
                    const syntheticEvent = {
                      target: { value: opt.value },
                    } as unknown as React.ChangeEvent<HTMLSelectElement>;

                    onChange?.(syntheticEvent);
                    setOpen(false);
                  }}
                  className={`cursor-pointer px-3 py-2 flex justify-between items-center hover:bg-gray-100 ${opt.value === value ? "bg-gray-50" : ""}`}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && <FaCheck className="text-blue-500 size-3" />}
                </div>
              ))
            ) : (
              <div className="p-2 text-sm text-gray-500">No options</div>
            )}
          </div>
        )}
      </div>

      {description && <p className="text-gray-500 text-xs">{description}</p>}
    </div>
  );
};

export function MultiDropdown({
  label,
  options,
  required = false,
  description,
  values,
  onChange,
  wrapperStyle,
  className,
}: {
  label?: string;
  options: Opt[];
  required?: boolean;
  description?: string;
  className?: string;
  wrapperStyle?: CSSProperties;
  values: string[];
  onChange: ((value: string[]) => void);
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectOption = (value: string) => {
    let updated: string[];

    if (values.includes(value)) {
      updated = values.filter((v) => v !== value);
    } else {
      updated = [...values, value];
    }

    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-y-2 w-full" style={wrapperStyle} ref={wrapperRef}>
      {label && (
        <span className="font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
      )}
      <div className="relative w-full bg-white">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`cursor-pointer w-full border border-gray-200 rounded-md p-2 flex justify-between items-center text-left hover:border-gray-300 focus:ring-2 focus:ring-blue-200 ${className}`}
        >
          <span className="truncate">
            {(() => {
              if (!values.length) return "Select an option";

              const selected = options
                .filter(opt => values.includes(opt.value))
                .map(opt => opt.label);

              if (selected.length === 1) return selected[0];

              if (selected.length === 2)
                return `${selected[0]} & ${selected[1]}`;

              return selected.join(", ");
            })()}
          </span>
          <FaChevronDown
            className={`text-gray-500 size-3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto z-10">
            {options.length > 0 ? (
              options.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => handleSelectOption(opt.value)}
                  className={`cursor-pointer px-3 py-2 flex justify-between items-center hover:bg-gray-100 ${values.includes(opt.value) ? "bg-gray-50" : ""}`}
                >
                  <span>{opt.label}</span>
                  {values.includes(opt.value) && <FaCheck className="text-blue-500 size-3" />}
                </div>
              ))
            ) : (
              <div className="p-2 text-sm text-gray-500">No options</div>
            )}
          </div>
        )}
      </div>

      {description && <p className="text-gray-500 text-xs">{description}</p>}
    </div>
  );
};

export function TextArea({ label, description, placeholder, value, error, required = false, onChange, ...props } : { label?: string, description?: string, placeholder: string, error?: string, value: string, required?: boolean, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
      <div className="flex flex-col gap-y-2 w-full">
          <span>
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
          <textarea
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              className={`border-[1px] ${error ? "border-red-500" : "border-gray-200"} p-2 rounded-md ${props.className ?? ""}`}
              {...props}
          />
          {!error && description && <p className="text-gray-500 text-xs max-w-1/2">{description}</p>}
          {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>
  )
}
