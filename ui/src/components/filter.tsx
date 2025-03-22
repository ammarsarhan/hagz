"use client";
import Input, { InputGroup } from "@/components/input";
import Button from "@/components/button";

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

const FilterSection = ({ label, type, options } : FilterSectionProps) => {
    if (type == "range" && options.length != 2) {
        throw new Error("Range filter must have exactly 2 options");
    }

    return (
        <div>
            <span className="text-sm text-gray-500 block mb-2">{label}</span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
                {
                    type == "checkbox" &&
                    options.map((option, index) => {
                        return (
                            <div className="flex items-center gap-x-2 text-sm" key={index}>
                                <input type="checkbox"/>
                                <span>{option}</span>
                            </div>
                        )
                    })
                }
                {
                    type == "range" &&
                    <div className="flex items-center gap-x-4">
                        {
                            options.map((label, index) => 
                                <InputGroup 
                                    placeholder={label} 
                                    value={""} 
                                    onChange={() => console.log("haga")} 
                                    label={label} key={index}
                                    className="text-sm"
                                />
                            )
                        }
                    </div>
                }
                {
                    type == "input" &&
                    <Input
                        placeholder={label}
                        value=""
                        onChange={() => console.log("haga")}
                        type="date"
                        className="text-sm"
                    />
                }
            </div>
        </div>
    )
}

export default function Filter() {
    return (
        <div className="w-96 border-l-[1px] h-full overflow-y-scroll py-3 px-4 flex flex-col gap-y-5">
            <Button className="text-sm" variant="disabled">Apply Filter</Button>
            <FilterSection label="Date" type="input"/>
            <FilterSection label="Time Range" type="range" options={["From", "To"]}/>
            <FilterSection label="Price Range" type="range" options={["Minimum", "Maximum"]}/>
            <FilterSection label="Ground Size" type="checkbox" options={["5-a-side", "7-a-side", "11-a-side"]}/>
            <FilterSection label="Ground Surface" type="checkbox" options={["Natural", "Artificial", "Turf"]}/>
            <FilterSection label="Amenities" type="checkbox" options={["Indoors", "Ball", "Seating", "Night Lights", "Parking", "Showers", "Lockers", "Cafeteria", "First Aid", "Security"]}/>
        </div>
    )
}