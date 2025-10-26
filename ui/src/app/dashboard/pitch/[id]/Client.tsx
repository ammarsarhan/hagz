"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchPitch } from "@/app/utils/api/client";
import Input, { Dropdown, TextArea } from "@/app/components/dashboard/Input";
import { Amenity, amenityMap, PitchDetails } from "@/app/utils/types/pitch";
import { useState } from "react";

const parseData = (data: PitchDetails) => {
    return {
        ...data,
        taxId: data.taxId || '',
        basePrice: String(data.basePrice),
        longitude: String(data.longitude),
        latitude: String(data.latitude),
        amenities: data.amenities as Amenity[]
    };
};

export default function Client({ id } : { id: string }) {
    const queryClient = useQueryClient();

    const { data } = useQuery({
        queryFn: () => fetchPitch(id),
        queryKey: ["dashboard", "pitch", id, "home"],
        initialData: () => queryClient.getQueryData(["dashboard", "pitch", id, "home"])
    });

    const initial = parseData(data);
    const [temp, setTemp] = useState(initial);

    return (
        <div className="mx-6 my-4 flex flex-col gap-y-12 [&>div]:last:pb-6">
            <div className="flex flex-col gap-y-6 mt-2">
                    <div className="flex items-center gap-x-16">
                        <h2 className="font-medium">Pitch Details</h2>
                    </div>
                    <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                        <div className="w-1/3">
                            <h3 className="font-medium mb-1">Basic Information</h3>
                            <p className="text-[0.8rem] text-gray-500">Primary information that is vital for the user to identify your pitch (e.g: Name, description, location, etc...)</p>
                        </div>
                        <div className="w-2/3 text-[0.8125rem]">
                            <div className="flex flex-col gap-y-5 py-5">
                                <div className="flex items-center w-full gap-x-4">
                                    <Input 
                                        label="Name"
                                        placeholder="Pitch Name"
                                        className="flex-1"
                                        value={temp.name}
                                        onChange={(e) => setTemp(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                    <Input 
                                        label="Tax ID"
                                        placeholder="Tax Identification Number"
                                        className="flex-1"
                                        value={temp.taxId}
                                        onChange={(e) => setTemp(prev => ({ ...prev, taxId: e.target.value }))}
                                    />
                                </div>
                                <div className="max-w-60">
                                    <Input 
                                        label="Base Price"
                                        placeholder="Price"
                                        value={temp.basePrice}
                                        onChange={(e) => setTemp(prev => ({ ...prev, basePrice: e.target.value }))}
                                        unit="EGP"
                                    />
                                </div>
                                <div>
                                    <TextArea 
                                        label="Description"
                                        placeholder="Pitch Description"
                                        value={temp.description}
                                        onChange={(e) => setTemp(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                        <div className="w-1/3">
                            <h3 className="font-medium mb-1">Location</h3>
                            <p className="text-[0.8rem] text-gray-500">Location information to help the user reach your pitch and index for radius search (e.g: City, Google Maps link, etc...)</p>
                        </div>
                        <div className="w-2/3 text-[0.8125rem]">
                            <div className="flex flex-col gap-y-5 py-5">
                                <div className="flex flex-col gap-y-5">
                                    <div className="flex items-center w-full gap-x-4">
                                        <Input 
                                            label="Street"
                                            placeholder="Pitch Name"
                                            className="flex-1"
                                            value={temp.street}
                                            onChange={(e) => setTemp(prev => ({ ...prev, street: e.target.value }))}
                                        />
                                        <Input 
                                            label="Area"
                                            placeholder="Tax Identification Number"
                                            className="flex-1"
                                            value={temp.area}
                                            onChange={(e) => setTemp(prev => ({ ...prev, area: e.target.value }))}
                                        />
                                    </div>
                                    <div className="flex items-center w-full gap-x-4">
                                        <Input 
                                            label="City"
                                            placeholder="Pitch Name"
                                            className="flex-1"
                                            value={temp.city}
                                            onChange={(e) => setTemp(prev => ({ ...prev, city: e.target.value }))}
                                        />
                                        <Dropdown 
                                            label="Country"
                                            className="flex-1"
                                            options={[
                                                { value: "EG", label: "Egypt" },
                                                { value: "SA", label: "Saudi Arabia" },
                                                { value: "AE", label: "United Arab Emirates" },
                                            ]} 
                                            value={temp.country}
                                            onChange={(e) => setTemp(prev => ({ ...prev, country: e.target.value }))}
                                        />
                                    </div>
                                    <div className="flex items-center w-full [&>div>p]:max-w-1/2">
                                        <Input 
                                            label="Google Maps Link"
                                            description="Adding a Google Maps link will allow us to index your pitch for radius-based search by extracting longitude and latitude information."
                                            placeholder="Google Maps Link"
                                            className="flex-1"
                                            link={{ title: "View location", href: initial.googleMapsLink }}
                                            value={temp.googleMapsLink}
                                            onChange={(e) => setTemp(prev => ({ ...prev, googleMapsLink: e.target.value }))}
                                        />
                                    </div>
                                    <div className="flex items-center w-full gap-x-4">
                                        <Input 
                                            label="Longitude"
                                            placeholder="Longitude"
                                            className="flex-1 text-gray-500"
                                            value={temp.longitude}
                                            onChange={(e) => setTemp(prev => ({ ...prev, longitude: e.target.value }))}
                                            readOnly
                                        />
                                        <Input 
                                            label="Latitude"
                                            placeholder="Latitude"
                                            className="flex-1 text-gray-500"
                                            value={temp.latitude}
                                            onChange={(e) => setTemp(prev => ({ ...prev, latitude: e.target.value }))}
                                            readOnly
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                        <div className="w-1/3">
                            <h3 className="font-medium mb-1">Additional Information</h3>
                            <p className="text-[0.8rem] text-gray-500">More information to make your pitch more appealing to users (e.g: Amenities, featured, etc...)</p>
                        </div>
                        <div className="w-2/3 text-[0.8125rem]">
                            <div className="flex flex-col gap-y-5 py-5">
                                <div className="flex flex-col gap-y-5">
                                    <div className="flex flex-col gap-y-3">
                                        <span className="text-sm">Amenities</span>
                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                                            {
                                                temp.amenities.map((amenity, index) => <span className="px-3 py-1 border-[1px] border-blue-700 text-blue-700 rounded-full" key={index}>{amenityMap.get(amenity)}</span>)
                                            }
                                        </div>
                                        
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        </div>
    )
}