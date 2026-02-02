import useFormContext from "@/app/context/Form";
import { DropdownGroup } from "@/app/components/dashboard/Dropdown";
import { InputGroup } from "@/app/components/dashboard/Input";

const countryOptions = [{ label: "Egypt", value: "EG" }, { label: "Saudi Arabia", value: "SA" }, { label: "United Arab Emirates", value: "AE" }]

export default function Location() {
    const { data, setData } = useFormContext();

    return (
        <div className="flex flex-col gap-y-4 w-full">
            <div className="flex gap-x-4">
                <InputGroup label={"Street"} onChange={(e) => setData({ ...data, street: e.target.value })} type={"text"} placeholder={"Street"} value={data.street} className="flex-1"/>
                <InputGroup label={"Area"} onChange={(e) => setData({ ...data, area: e.target.value })} type={"text"} placeholder={"Area"} value={data.area} className="flex-1"/>
            </div>
            <div className="flex gap-x-4">
                <InputGroup label={"City"} onChange={(e) => setData({ ...data, city: e.target.value })} type={"text"} placeholder={"City"} value={data.street} className="flex-1"/>
                <DropdownGroup onChange={(value) => setData({ ...data, country: value })} placeholder={"Select country"} value={data.country} options={countryOptions} label={"Country"} className="flex-1"/>
            </div>
        </div>
    )
}