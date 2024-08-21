"use client"

import Logo from '@/app/components/Logo'
import Button from '@/app/components/Button'
import Carousel, { CarouselSlideType } from '@/app/components/Carousel'

import { useState } from 'react'

const slides: CarouselSlideType[] = [
    {
        title: "Slide 1",
        description: "Lorem ipsum dolor, sit amet consectetur adipisicing elit. Maxime vitae commodi explicabo odit nostrum, officiis odio non mollitia rerum quod numquam culpa id nemo error sit sunt aliquam veritatis. Tempore.",
        image: ""
    },
    {
        title: "Slide 2",
        description: "Lorem ipsum dolor, sit amet consectetur adipisicing elit. Maxime vitae commodi explicabo odit nostrum, officiis odio non mollitia rerum quod numquam culpa id nemo error sit sunt aliquam veritatis. Tempore.",
        image: ""
    },
    {
        title: "Slide 3",
        description: "Lorem ipsum dolor, sit amet consectetur adipisicing elit. Maxime vitae commodi explicabo odit nostrum, officiis odio non mollitia rerum quod numquam culpa id nemo error sit sunt aliquam veritatis. Tempore.",
        image: ""
    },
    {
        title: "Slide 4",
        description: "Lorem ipsum dolor, sit amet consectetur adipisicing elit. Maxime vitae commodi explicabo odit nostrum, officiis odio non mollitia rerum quod numquam culpa id nemo error sit sunt aliquam veritatis. Tempore.",
        image: ""
    },
    {
        title: "Slide 5",
        description: "Lorem ipsum dolor, sit amet consectetur adipisicing elit. Maxime vitae commodi explicabo odit nostrum, officiis odio non mollitia rerum quod numquam culpa id nemo error sit sunt aliquam veritatis. Tempore.",
        image: ""
    },
]

export default function Onboarding () {
    const [currentSlide, setCurrentSlide] = useState(0);

    return (
        <div className="h-screen bg-secondary p-4">
            <Carousel step={currentSlide} slides={slides}/>
            <div className='flex absolute bottom-4 right-4 gap-x-4'>
                {
                    // If on the first slide, allow user to skip
                    currentSlide === 0 &&
                    <Button label="Skip" variant="inverted" onClick={() => setCurrentSlide(slides.length - 1)}/>
                }
                {
                    // If not on the first slide, allow user to traverse backwards
                    currentSlide > 0 &&
                    <Button label="Back" variant="secondary" onClick={() => setCurrentSlide(currentSlide - 1)}/>
                }
                {
                    // If not on the last slide, allow user to traverse forwards
                    currentSlide < slides.length - 1 &&
                    <Button label="Next" variant="secondary" onClick={() => setCurrentSlide(currentSlide + 1)}/>
                }
                {
                    // If on the last slide, give user option to create account
                    currentSlide === slides.length - 1 &&
                    <Button label="Let's Get Started!" variant="primary" onClick={() => console.log("Finished")}/>
                }
            </div>
        </div>
    )
}