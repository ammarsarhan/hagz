import Image, { StaticImageData } from 'next/image'
import { ReactNode } from 'react'

interface CarouselProps {
    step: number
    slides: CarouselSlideType[]
}

export type CarouselSlideType = {
    title: string;
    description: string;
    image?: StaticImageData;
    child?: ReactNode;
}

export default function Carousel ({step, slides}: CarouselProps) {
    // Carousel component should not be responsible for rotating through slides, this should be done externally
    // Therefore, using props and passing state through a parent component should suffice

    if (step % 2 != 0) return (
        <div className="h-[77.5vh] grid grid-cols-3 gap-4 p-4">
            <div className="flex-center flex-col gap-y-6 px-4 col-span-2">
                <h1 className="text-4xl font-bold">{slides[step].title}</h1>
                <p className="text-lg">{slides[step].description}</p>
            </div>
            {
                // If image exists, then display it
                slides[step].image && <div className='relative'><Image fill src={slides[step].image} alt={`Slide ${step + 1} Image`} className='rounded-lg h-full w-full bg-black object-cover'/></div>
            }
            {
                // If form exists, then display it
                slides[step].child && <>{slides[step].child}</>
            }
        </div>
    )

    if (step % 2 === 0) return (
        <div className="h-[77.5vh] grid grid-cols-2 gap-4 p-4">
            {
                // If image exists, then display it
                slides[step].image && <div className='relative'><Image fill src={slides[step].image} alt={`Slide ${step + 1} Image`} className='rounded-lg h-full w-full bg-black object-cover'/></div>
            }
            {
                // If form exists, then display it
                slides[step].child && <>{slides[step].child}</>
            }
            <div className="flex-center flex-col gap-y-6 px-4">
                <h1 className="text-4xl font-bold">{slides[step].title}</h1>
                <p className="text-lg">{slides[step].description}</p>
            </div>
        </div>
    )
}