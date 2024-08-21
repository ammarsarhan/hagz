import Image from 'next/image'

interface CarouselProps {
    step: number
    slides: CarouselSlideType[]
}

export type CarouselSlideType = {
    title: string;
    description: string;
    image: string;
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
            <div className='relative'><Image fill src={slides[step].image} alt={`Slide ${step + 1} Image`} className='rounded-lg h-full w-full bg-black'/></div>
        </div>
    )

    if (step % 2 === 0) return (
        <div className="h-[77.5vh] grid grid-cols-2 gap-4 p-4">
            <div className='relative'><Image fill src={slides[step].image} alt={`Slide ${step + 1} Image`} className='rounded-lg h-full w-full bg-black'/></div>
            <div className="flex-center flex-col gap-y-6 px-4">
                <h1 className="text-4xl font-bold">{slides[step].title}</h1>
                <p className="text-lg">{slides[step].description}</p>
            </div>
        </div>
    )
}