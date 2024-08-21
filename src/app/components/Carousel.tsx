import Progress from "@/app/components/Progress"

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
    return (
        <div className="">
            {/* Progress component created as an indicator, takes in number of slides and current active slide */}
            <Progress current={step} count={slides.length}/>
            <div>
                {slides[step].image}
                {slides[step].title}
                {slides[step].description}
            </div>
        </div>
    )
}