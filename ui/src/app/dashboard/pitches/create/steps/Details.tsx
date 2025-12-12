import Input, { Dropdown, TextArea } from "@/app/components/dashboard/Input"
import useFormContext from "@/app/context/useFormContext";
import { useState } from "react";
import { BiPlus } from "react-icons/bi";
import { IoIosClose } from "react-icons/io";
import { MdOutlineCloudUpload } from 'react-icons/md';

import z from "zod"
import { amenities, Amenity, amenityMap } from "@/app/utils/types/pitch";
import { AnimatePresence, motion } from "framer-motion";

export const detailsSchema = z.object({
    name: z.string("Pitch name is required.")
        .min(4, "Pitch name must have at least 4 characters.")
        .max(100, "Pitch name must have 100 characters at most."),
    taxId: z.string("Tax Identification Number (TIN) must be a string.")
        .transform((val) => (val === "" ? null : val))
        .nullable()
        .refine((val) => val === null || /^(?:EG\s*)?\d{3}[-\s]?\d{3}[-\s]?\d{3}$/.test(val!), "Invalid Egyptian TIN (expected 9 digits)."),
    basePrice: z.string("Base price is required.")
        .min(2, "This field is required.")
        .transform(Number)
        .refine((val) => val >= 50 && val <= 2000, {
            message: "Base price must be between 50 and 2000 EGP per hour.",
        }),
    description: z.string("Pitch description is required.")
        .min(5, "Pitch description must have at least 5 characters.")
        .max(500, "Pitch description must have 500 characters at most."),
    street: z.string("Street address is required.")
        .min(4, "Street address must have at least 4 characters.")
        .max(100, "Street address must have 100 characters at most."),
    area: z.string("Area is required.")
        .min(2, "Area must have at least 2 characters.")
        .max(100, "Area must have 100 characters at most."),
    city: z.string("City is required.")
        .min(2, "City must have at least 2 characters.")
        .max(100, "City must have 100 characters at most."),
    country: z.enum(["EG", "SA", "AE"], "A valid country code is required."),
    latitude: z.string("Latitude is required.")
        .trim()
        .refine(
            (val) => val === "" || /^-?\d+(\.\d+)?$/.test(val),
            "Invalid latitude format."
        )
        .transform((val) => (val === "" ? null : Number(val)))
        .nullable()
        .refine(
            (val) => val === null || (val >= -90 && val <= 90),
            "Latitude must be between -90 and 90"
        ),
    longitude: z.string("Longitude is required.")
        .trim()
        .refine(
            (val) => val === "" || /^-?\d+(\.\d+)?$/.test(val),
            "Invalid longitude format."
        )
        .transform((val) => (val === "" ? null : Number(val)))
        .nullable()
        .refine(
            (val) => val === null || (val >= -180 && val <= 180),
            "Longitude must be between -180 and 180"
        ),
    googleMapsLink: z.string("Google Maps link is required.")
}).superRefine((data, ctx) => {
    let link = data.googleMapsLink?.trim();
    if (!link) {
        ctx.addIssue({
            code: "custom",
            path: ["googleMapsLink"],
            message: "Google Maps link is required.",
        });
        return;
    }

    // Normalize (add protocol + www if missing)
    if (!/^https?:\/\//i.test(link)) link = "https://" + link;
    if (!/^https?:\/\/(www\.)?/i.test(link)) link = link.replace(/^https?:\/\//i, "https://www.");
    data.googleMapsLink = link;

    // Domain validation
    const isGoogleMaps = /https:\/\/(www\.)?google\.[a-z.]+\/maps\//i.test(link);
    const isShortLink = /https:\/\/(goo\.gl|maps\.app\.goo\.gl)\//i.test(link);

    if (!isGoogleMaps && !isShortLink) {
        ctx.addIssue({
            code: "custom",
            path: ["googleMapsLink"],
            message: "Invalid Google Maps link format.",
        });
        return;
    }

    // Short links can't contain coordinates — reject
    if (isShortLink) {
        ctx.addIssue({
            code: "custom",
            path: ["googleMapsLink"],
            message:
                "Short Google Maps sharing links (e.g. goo.gl or maps.app.goo.gl) can’t be used. Please open the link and copy the full URL from your browser’s address bar.",
        });
        return;
    }

    // Try to extract coordinates from all common formats
    const patterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,        // .../@30.0444,31.2357,17z
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,    // ...!3d30.0444!4d31.2357
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,   // ...?q=30.0444,31.2357
        /%40(-?\d+\.\d+),(-?\d+\.\d+)/,      // encoded @ e.g. %4030.0444,31.2357
    ];

    let lat: number | null = null;
    let lng: number | null = null;

    for (const pattern of patterns) {
        const match = link.match(pattern);
        if (match) {
            lat = parseFloat(match[1]);
            lng = parseFloat(match[2]);
            break;
        }
    }

    if (lat !== null && lng !== null) {
        if (data.latitude === null) data.latitude = lat;
        if (data.longitude === null) data.longitude = lng;
    } else {
        ctx.addIssue({
            code: "custom",
            path: ["googleMapsLink"],
            message: "Could not extract coordinates. Please paste the full Google Maps URL (not a short sharing link).",
        });
    }
});

const AddAmenityModal = ({ isOpen, onClose } : { isOpen: boolean, onClose: () => void }) => {
    const { formData, setFormData } = useFormContext();

    const handleAmenity = (key: Amenity) => {
        const exists = formData.details.amenities.includes(key);

        // If it already exists within the context array, remove it
        if (exists) {
            setFormData({
                ...formData,
                details: {
                    ...formData.details,
                    amenities: formData.details.amenities.filter((amenity: Amenity) => amenity !== key)
       
                }
            })
        }

        // If it does not append it to the list
        else {
            setFormData({
                ...formData,
                details: {
                    ...formData.details,
                    amenities: [...formData.details.amenities, key]
                }
            })
        }
    };

    return (
        <AnimatePresence>
            {
                isOpen &&
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50" onClick={onClose}>
                    <div className="flex flex-col gap-y-4 gap-x-4 bg-gray-50 rounded-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-x-8 w-full">
                            <div className="flex-1 flex flex-col gap-y-0.5 mt-1">
                                <h2 className="text-sm font-medium">Add Amenities</h2>
                                <p className="text-[0.8125rem] text-gray-500">Select the amenities you want to add to your pitch.</p>
                            </div>
                            <button className="flex-shrink-0 hover:text-gray-600 cursor-pointer" type="button" onClick={onClose}>
                                <IoIosClose className="size-6"/>
                            </button>
                        </div>
                        <div className="flex flex-col gap-y-6 my-2 bg-white border-[1px] border-gray-300 p-4 rounded-md">
                            {
                                amenities.map((item, index) => {
                                    return (
                                        <div key={index}>
                                            <h3 className="font-medium first:mb-2">{item.group}</h3>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                {
                                                    item.items.map((amenity) => {
                                                        return (
                                                            <button onClick={() => handleAmenity(amenity.key)} key={amenity.key} type="button" className={`${formData.details.amenities.includes(amenity.key) ? 'bg-blue-100 text-blue-800 border-transparent' : 'border-gray-200'} flex items-center gap-x-2 transition-colors rounded-md border-[1px] px-3 py-1.5 cursor-pointer`}>
                                                                {amenity.icon}
                                                                <span className="text-[0.8125rem]">{amenity.label}</span>
                                                            </button>
                                                        );
                                                    })
                                                }
                                            </div>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    )
}

export default function Details() {
    const { formData, setFormData, errors } = useFormContext();

    const [isAddAmenityModalOpen, setIsAddAmenityModalOpen] = useState(false);

    return (
        <>
            <AddAmenityModal isOpen={isAddAmenityModalOpen} onClose={() => setIsAddAmenityModalOpen(false)} />
            <div className="flex items-start gap-x-4">
                <Input 
                    label="Pitch Name" 
                    placeholder="Name" 
                    required 
                    value={formData.details.name} 
                    onChange={(e) => setFormData({ ...formData, details: { ...formData.details, name: e.target.value } })} 
                    error={errors?.["details.name"]}
                />
                <Input 
                    label="Tax Identification Number (TIN)" 
                    placeholder="TIN" 
                    description="A tax identification number is not required but will make the verification process a lot smoother and faster."
                    value={formData.details.taxId}
                    onChange={(e) => setFormData({ ...formData, details: { ...formData.details, taxId: e.target.value } })}
                    error={errors?.["details.taxId"]}
                />
            </div>
            <div className="my-4 w-[calc(50%-0.5rem)]">
                <Input 
                    label="Base Price" 
                    placeholder="Base Pitch Price (in EGP)" 
                    required
                    value={formData.details.basePrice}
                    onChange={(e) => setFormData({ ...formData, details: {...formData.details, basePrice: e.target.value } })}
                    error={errors?.["details.basePrice"]}
                    unit="EGP"
                    description="Set the base price for your pitch per hour. This is the minimum price users will see when booking your pitch."
                />
            </div>
            <div className="my-4">
                <TextArea 
                    label={"Pitch Description (500 characters max)"} 
                    placeholder={"Description"} 
                    value={formData.details.description} 
                    onChange={(e) => setFormData({ ...formData, details: { ...formData.details, description: e.target.value } })} 
                    error={errors?.["details.description"]}
                    required
                />
            </div>
            <div className="flex flex-col gap-y-4 my-4">
                <div className="flex items-start gap-x-4">
                    <Input 
                        label="Street Address" 
                        placeholder="Street Address" 
                        required
                        value={formData.details.street}
                        onChange={(e) => setFormData({ ...formData, details: { ...formData.details, street: e.target.value } })}
                        error={errors?.["details.street"]}
                    />
                    <Input 
                        label="Area" 
                        placeholder="Area" 
                        required
                        value={formData.details.area}
                        onChange={(e) => setFormData({ ...formData, details: { ...formData.details, area: e.target.value } })}
                        error={errors?.["details.area"]}
                    />
                </div>
                <div className="flex items-start gap-x-4">
                    <Input 
                        label="City" 
                        placeholder="City" 
                        required
                        value={formData.details.city}
                        onChange={(e) => setFormData({ ...formData, details: { ...formData.details, city: e.target.value } })}
                        error={errors?.["details.city"]}
                    />
                    <Dropdown 
                        label="Country" 
                        options={[
                            { value: "EG", label: "Egypt" },
                            { value: "SA", label: "Saudi Arabia" },
                            { value: "AE", label: "United Arab Emirates" },
                        ]} 
                        value={formData.details.country}
                        onChange={(e) => setFormData({ ...formData, details: { ...formData.details, country: e.target.value } })}
                        required
                    />
                </div>
                <div className="flex items-start gap-x-4">
                    <Input 
                        label="Latitude" 
                        placeholder="Latitude"
                        value={formData.details.latitude}
                        onChange={(e) => setFormData({ ...formData, details: { ...formData.details, latitude: e.target.value } })}
                        error={errors?.["details.latitude"]}
                    />
                    <Input
                        label="Longitude" 
                        placeholder="Longitude"
                        value={formData.details.longitude}
                        onChange={(e) => setFormData({ ...formData, details: { ...formData.details, longitude: e.target.value } })}
                        error={errors?.["details.longitude"]}
                    />
                </div>
                <div className="w-1/2 pr-2">
                    <Input
                        label="Google Maps Link" 
                        placeholder="Link" 
                        description="Adding a Google Maps link helps users find your location easier and helps us index your pitch better for radius-based search."
                        value={formData.details.googleMapsLink}
                        onChange={(e) => setFormData({ ...formData, details: { ...formData.details, googleMapsLink: e.target.value } })}
                        error={errors?.["details.googleMapsLink"]}
                        required
                    />
                </div>
            </div>
            <div className="flex flex-col gap-y-3">
                <label>
                    Amenities <span>({formData.details.amenities.length})</span>
                </label>
                {
                    formData.details.amenities.length > 0 &&
                    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                        {
                            formData.details.amenities.map((amenity: Amenity, index: number) => <li className="px-4 py-1.5 border-[1px] border-blue-700 text-blue-700 rounded-full" key={index}>{amenityMap.get(amenity)}</li>)
                        }
                    </ul>
                }
                <button onClick={() => setIsAddAmenityModalOpen(true)} type="button" className="mt-1 flex items-center justify-center gap-x-1.5 rounded-md border-[1px] px-3 py-2 border-gray-300 hover:bg-gray-100 transition-colors w-fit cursor-pointer">
                    <BiPlus className="size-3.5"/> 
                    <span className="text-xs">Add Amenity</span>
                </button>
            </div>
            <div className="flex flex-col gap-y-4 mt-6">
                <div className="flex flex-col gap-y-2 w-full">
                    <label>
                        Pitch Images
                        <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="p-4 flex items-center gap-x-4 rounded-md border-[1px] border-gray-200 bg-gray-50 border-dashed">
                        <MdOutlineCloudUpload className="size-5 text-gray-700"/>
                        <div>
                            <p className="text-gray-500"><button type="button" className="cursor-pointer text-black underline">Click to upload</button> or drag and drop.</p>
                            <p className="text-gray-500 text-xs">PNG, JPG, GIF up to 10MB.</p>
                        </div>
                    </div>
                    <p className="text-gray-500 text-xs max-w-1/2">The first image uploaded will be used as the cover. Adding images helps boost your pitch in search results and rank higher.</p>
                </div>
            </div>
        </>
    )
}