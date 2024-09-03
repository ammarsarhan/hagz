'use client'
import { Expand } from "lucide-react"
import Image from "next/image"
import Button from "@/app/components/Button"

interface GalleryProps {
    images: string[]
}

export default function Gallery ({ images } : GalleryProps) {
    return (
        <div className="h-[75vh] flex flex-col gap-4">
            <div className="w-full h-3/4 relative">
                <Image src={images[0]} fill alt="Primary image" className="rounded-xl object-cover"/>
                <Button variant="primary" className="bg-white border-none absolute bottom-4 right-4">Open Gallery</Button>
            </div>
            <div className="grid grid-cols-4 gap-4 w-full h-1/4">
                {
                    images.slice(1).map((image, index) => {
                        return (
                            <div className="w-full h-full relative group" key={index}>
                                <Image src={image} fill alt="Primary image" className="rounded-xl object-cover"/>
                                <div className="flex-center absolute w-full h-full rounded-xl transition-all bg-light-gray bg-opacity-0 group-hover:bg-opacity-70 cursor-pointer">
                                    <Button variant="primary" className="opacity-0 group-hover:opacity-100 bg-white px-[0.5rem]"><Expand className="w-4 h-4 text-primary-black outline-none"/></Button>
                                </div>
                            </div>
                        )
                    })
                }
            </div>
        </div>
    )
}