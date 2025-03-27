import { AmenityFilterType, amenityMap, AmenityType } from "@/context/filter"
import getCurrencyString from "@/utils/currency"
import { getKeyFromValue } from "@/utils/map"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

export interface PitchDataType {
    id: string,
    name: string,
    images: string[],
    amenities: AmenityType[],
    priceRange: number[],
    coordinates: {
        type: "Point",
        coordinates: number[]
    },
    location: {
        street: string,
        district: string,
        city: string,
        governorate: string,
        country: string,
        postalCode?: number,
        externalLink?: string
    },
    updatedAt: string
};

export default function Card ({ id, name, images, amenities, priceRange, coordinates, location, updatedAt } : PitchDataType) {
    const min = priceRange[0];
    const max = priceRange[1];

    const displayAmenities = amenities.map(el => getKeyFromValue<AmenityType, AmenityFilterType>(amenityMap, el)!)

    return (
        <div className="flex-center">
            <Link className="flex flex-col gap-y-4 p-4 border-1" href={`/pitch/${id}`}>

            </Link>
        </div>
    )
}