import { motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import { DropdownGroup } from "@/app/components/dashboard/Dropdown";
import { InputGroup } from "@/app/components/dashboard/Input";
import { CountryEnum, CreatePitchFormType } from "@/app/utils/types/dashboard";

const countryOptions = [
    { label: "Egypt", value: "EG", language: "English & Arabic", currency: "EGP" }, 
    { label: "Saudi Arabia", value: "SA", language: "English & Arabic", currency: "SAR" }, 
    { label: "United Arab Emirates", value: "AE", language: "English & Arabic", currency: "AED" }
];

export default function Location() {
    const { data, setData } = useFormContext<CreatePitchFormType>();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-[calc(100vh-2rem)] flex-center flex-col gap-y-6 w-3xl"
        >   
            <div className="flex flex-col gap-y-3 w-full">
                <span className="text-sm">Pitch Location</span>
                <div className="flex flex-col gap-y-3">
                    <div className="flex gap-x-4 w-full">
                        <InputGroup label={"Street"} onChange={(e) => setData(prev => ({ ...prev, street: e.target.value }))} type={"text"} placeholder={"Street"} value={data.street} className="flex-1"/>
                        <InputGroup label={"Area"} onChange={(e) => setData(prev => ({ ...prev, area: e.target.value }))} type={"text"} placeholder={"Area"} value={data.area} className="flex-1"/>
                    </div>
                    <div className="flex gap-x-4 w-full">
                        <InputGroup label={"City"} onChange={(e) => setData(prev => ({ ...prev, city: e.target.value }))} type={"text"} placeholder={"City"} value={data.street} className="flex-1"/>
                        <DropdownGroup onChange={(value) => setData(prev => ({ ...prev, country: value as CountryEnum }))} placeholder={"Select country"} value={data.country} options={countryOptions} label={"Country"} className="flex-1"/>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-y-3 w-full">
                <span className="text-sm">Locale & Currency</span>
                <div className="flex flex-col gap-y-3">
                    <div className="flex gap-x-4 w-full">
                        <InputGroup label={"Language"} type={"text"} placeholder={"Language"} value={countryOptions.find(option => option.value === data.country)!.language} readOnly className="flex-1"/>
                        <InputGroup label={"Currency"} type={"text"} placeholder={"Currency"} value={countryOptions.find(option => option.value === data.country)!.currency} readOnly className="flex-1"/>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}