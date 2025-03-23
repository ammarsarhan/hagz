"use client";

import Input, { InputGroup } from "@/components/input";
import { useFilterContext } from "@/context/filter";
import { X } from "lucide-react";

interface BaseFilterSectionProps {
    label: string;
}

interface OptionsFilter extends BaseFilterSectionProps {
    type: "range" | "checkbox";
    options: string[];
}

interface InputFilter extends BaseFilterSectionProps {
    type: "input";
    options?: never;
}

type FilterSectionProps = OptionsFilter | InputFilter;

const FilterSection = ({ label, type, options }: FilterSectionProps) => {
    if (type === "range" && options.length !== 2) {
        throw new Error("Range filter must have exactly 2 options");
    }

    return (
        <div>
            <span className="text-sm text-gray-500 block mb-2">{label}</span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
                {type === "checkbox" &&
                    options.map((option, index) => (
                        <div className="flex items-center gap-x-2 text-sm" key={index}>
                            <input
                                type="checkbox"
                            />
                            <span>{option}</span>
                        </div>
                    ))}

                {type === "range" && (
                    <div className="flex items-center gap-x-4">
                        {options.map((label, index) => (
                            <InputGroup
                                key={index}
                                placeholder={label}
                                label={label}
                                className="text-sm"
                                value=""
                                onChange={() => null}
                            />
                        ))}
                    </div>
                )}

                {type === "input" && (
                    <Input
                        placeholder={label}
                        type="date"
                        className="text-sm"
                        value=""
                        onChange={() => null}
                    />
                )}
            </div>
        </div>
    );
};

export default function Filter() {
    const { open, setOpen } = useFilterContext();

    if (open) {
        return (
            <div className="fixed top-0 left-0 z-50 h-screen w-screen flex-center bg-black/30">
                <div className="p-6 bg-white rounded-md w-1/3">
                    <div className="flex items-center justify-between">
                        <span>Filters</span>
                        <button onClick={() => setOpen(false)}><X className="w-4 h-4"/></button>
                    </div>
                </div>
            </div>
        );
    }
}

// <div className="flex flex-col gap-y-6 max-h-[75vh] overflow-y-scroll">
// <FilterSection
//     label="Date"
//     type="input"
// />
// <FilterSection
//     label="Time Range"
//     type="range"
//     options={["From", "To"]}
// />
// <FilterSection
//     label="Price Range"
//     type="range"
//     options={["Minimum", "Maximum"]}
// />
// <FilterSection
//     label="Price Range"
//     type="range"
//     options={["Minimum", "Maximum"]}
// />
// <FilterSection
//     label="Price Range"
//     type="range"
//     options={["Minimum", "Maximum"]}
// />
// <FilterSection
//     label="Ground Size"
//     type="checkbox"
//     options={["5-a-side", "7-a-side", "11-a-side"]}
// />
// <FilterSection
//     label="Ground Surface"
//     type="checkbox"
//     options={["Natural", "Artificial", "Turf"]}
// />
// <FilterSection
//     label="Amenities"
//     type="checkbox"
//     options={[
//         "Indoors",
//         "Ball",
//         "Seating",
//         "Night Lights",
//         "Parking",
//         "Showers",
//         "Lockers",
//         "Cafeteria",
//         "First Aid",
//         "Security",
//     ]}
// />
// </div>
