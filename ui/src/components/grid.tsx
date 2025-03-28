import { amenityMap, AmenityType } from "@/context/filter"
import { getKeyFromValue } from "@/utils/map"
import getCurrencyString from "@/utils/currency"
import Image from "next/image"
import Link from "next/link"

import Skeleton from 'react-loading-skeleton'

export interface GridCardProps {
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
    grounds: number,
    updatedAt: string
};

export function GridCard ({ id, name, images, amenities, priceRange, location, grounds } : GridCardProps) {
    const groundsLabel = grounds > 1 ? `${grounds} Grounds` : `${grounds} Ground`;
    const amenity = getKeyFromValue(amenityMap, amenities[0]);

    return (
        <div className="flex-center py-4">
            <Link href={`/pitch/${id}`}>
                <div className="w-80 h-80 bg-gray-300 relative">
                    <Image fill src={images[0]} alt={`Main ${name} image`} className="object-fill"/>
                </div>
                <div className="flex flex-col mt-5">
                    <span className="text-xs mb-2">{id}</span>
                    <div className="flex items-center justify-between gap-x-8">
                        <span className="text-sm text-gray-500 mb-1">{groundsLabel}</span>
                        {
                            amenities.length > 0 &&
                            <div className="text-xs border-[1px] px-3 py-1 rounded-md">
                                {amenity}
                            </div>
                        }
                    </div>
                    <span>{name}</span>
                    <span className="text-gray-500 text-sm mt-1">{location.district}, {location.governorate}</span>
                    <span className="text-sm">{getCurrencyString(priceRange[0])}</span>
                </div>
            </Link>
        </div>
    )
}

export function GridCardSkeleton() {
    return (
        <div className="flex-center">
            <div className="w-80">
                <Skeleton className="h-80 rounded-none!"/>
                <div className="flex flex-col mt-5">
                    <span className="mb-1"><Skeleton className="rounded-none!"/></span>
                    <span className="mb-2"><Skeleton className="rounded-none!"/></span>
                </div>
            </div>
        </div>
    )
}

export default function Grid ({ data, loading } : { data : GridCardProps[], loading: boolean }) {
    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(325px,1fr))] gap-x-2 gap-y-8 mb-6">
            {
                !loading ?
                data.map((item, index) => <GridCard {...item} key={index}/>) :
                Array(8).fill(0).map((_, index) => <GridCardSkeleton key={index}/>)
            }
        </div>
    )
}
