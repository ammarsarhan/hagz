'use client'

import { useEffect, useState } from "react"

import Image from "next/image"
import Button from "@/components/ui/Button"
import { Expand, X } from "lucide-react"

interface GalleryProps {
    title: string,
    images: string[]
}

export default function Gallery ({ title, images } : GalleryProps) {
    const [openGallery, setOpenGallery] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)

    useEffect(() => {
        openGallery ? document.body.style.overflow = 'hidden' : document.body.style.overflow = 'auto'
    }, [openGallery])

    return (
        <div className="h-[75vh] flex flex-col gap-4">
            {
                openGallery && 
                <div className="fixed top-0 left-0 z-50 w-screen h-screen bg-gray-100">
                    <div className="flex-center w-full h-full">
                        <div className="p-5 h-5/6 w-5/6 overflow-x-scroll overflow-y-hidden whitespace-nowrap [&>*:first-child]:ml-0 [&>*:last-child]:mr-0">
                            {
                                images.map((image, index) => {
                                    return (
                                        <div className="relative w-5/6 h-full inline-block mx-8" key={index}>
                                            <Image src={image} fill alt="Primary image" className="object-cover"/>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    </div>
                    <Button variant="primary" className="flex items-center gap-x-2 absolute right-6 bottom-6 text-sm hover:text-gray-600 transition-colors" onClick={() => setOpenGallery(false)}><X className="w-4 h-4"/> Close</Button>
                </div>
            }
            <div className="w-full h-3/4 relative">
                <Image src={images[activeIndex]} fill alt="Primary image" className="rounded-xl object-cover"/>
                <Button variant="primary" className="bg-white border-none absolute bottom-4 right-4" onClick={() => openGallery ? setOpenGallery(false) : setOpenGallery(true)}>Open Gallery</Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full h-1/2 sm:h-1/4">
                {
                    images.slice(1).map((image, index) => {
                        return (
                            <div className="w-full h-full relative group" key={index}>
                                <Image src={image} fill alt="Primary image" className="rounded-xl object-cover"/>
                                <div onClick={() => setOpenGallery(true)} className="flex-center absolute w-full h-full rounded-xl transition-all bg-light-gray bg-opacity-0 group-hover:bg-opacity-70 cursor-pointer">
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