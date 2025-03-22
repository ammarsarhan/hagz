"use client";
import { useEffect, useState } from "react";
import Input, { InputGroup } from "@/components/input";
import Button from "@/components/button";
import { z } from "zod";

interface BaseFilterSectionProps {
    label: string;
}

interface OptionsFilter extends BaseFilterSectionProps {
    type: "range" | "checkbox";
    options: string[];
    value: any;
    onChange: (value: any) => void;
}

interface InputFilter extends BaseFilterSectionProps {
    value: any;
    onChange: (value: any) => void;
    type: "input";
    options?: never;
}

type FilterSectionProps = OptionsFilter | InputFilter & {
    value: any;
    onChange: (value: any) => void;
};

const FilterSection = ({ label, type, options, value, onChange }: FilterSectionProps) => {
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
                                checked={value.includes(option)}
                                onChange={(e) => {
                                    const newValue = e.target.checked
                                        ? [...value, option]
                                        : value.filter((v: string) => v !== option);
                                    onChange(newValue);
                                }}
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
                                value={value[index] || ""}
                                onChange={(e) => {
                                    const newValue = [...value];
                                    newValue[index] = e.target.value;
                                    onChange(newValue);
                                }}
                                label={label}
                                className="text-sm"
                            />
                        ))}
                    </div>
                )}

                {type === "input" && (
                    <Input
                        placeholder={label}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        type="date"
                        className="text-sm"
                    />
                )}
            </div>
        </div>
    );
};

export default function Filter() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [previous, setPrevious] = useState({
        date: "",
        timeRange: ["", ""],
        priceRange: ["", ""],
        groundSize: [],
        groundSurface: [],
        amenities: [],
    });

    const [filters, setFilters] = useState(previous);
    const [changed, setChanged] = useState(false);

    useEffect(() => {
        setChanged(JSON.stringify(filters) !== JSON.stringify(previous));
    }, [filters, previous]);

    const schema = z.object({
        date: z.string().date().optional(),
        
    })

    const setErrorWithTimeout = (message: string) => {
        alert(message);
    }

    const validateFilters = () => {
        const parsed = schema.safeParse(filters);
        
        if (!parsed.success) {
            setErrorWithTimeout(parsed.error.errors[0].message);
        }

        return parsed.data;
    }

    const applyFilter = () => {
        setLoading(true);

        setPrevious(filters);
        setChanged(false);

        setLoading(false);
    };

    return (
        <div className="w-96 border-l-[1px] h-full overflow-y-scroll py-3 px-4 flex flex-col justify-between gap-y-5">
            <div className="flex flex-col gap-y-5">
                <FilterSection
                    label="Date"
                    type="input"
                    value={filters.date}
                    onChange={(value) => setFilters((prev) => ({ ...prev, date: value }))}
                />
                <FilterSection
                    label="Time Range"
                    type="range"
                    options={["From", "To"]}
                    value={filters.timeRange}
                    onChange={(value) => setFilters((prev) => ({ ...prev, timeRange: value }))}
                />
                <FilterSection
                    label="Price Range"
                    type="range"
                    options={["Minimum", "Maximum"]}
                    value={filters.priceRange}
                    onChange={(value) => setFilters((prev) => ({ ...prev, priceRange: value }))}
                />
                <FilterSection
                    label="Ground Size"
                    type="checkbox"
                    options={["5-a-side", "7-a-side", "11-a-side"]}
                    value={filters.groundSize}
                    onChange={(value) => setFilters((prev) => ({ ...prev, groundSize: value }))}
                />
                <FilterSection
                    label="Ground Surface"
                    type="checkbox"
                    options={["Natural", "Artificial", "Turf"]}
                    value={filters.groundSurface}
                    onChange={(value) => setFilters((prev) => ({ ...prev, groundSurface: value }))}
                />
                <FilterSection
                    label="Amenities"
                    type="checkbox"
                    options={[
                        "Indoors",
                        "Ball",
                        "Seating",
                        "Night Lights",
                        "Parking",
                        "Showers",
                        "Lockers",
                        "Cafeteria",
                        "First Aid",
                        "Security",
                    ]}
                    value={filters.amenities}
                    onChange={(value) => setFilters((prev) => ({ ...prev, amenities: value }))}
                />
            </div>
            <div>
                <Button className="w-full text-sm" variant={changed ? "primary" : "disabled"} onClick={applyFilter}>
                    {loading ? "Loading..." : "Apply Filters"}
                </Button>
            </div>
        </div>
    );
}
