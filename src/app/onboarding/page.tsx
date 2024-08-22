"use client"

import Link from 'next/link'

import Input from '@/app/components/Input'
import Button from '@/app/components/Button'
import Progress from '@/app/components/Progress'
import Carousel, { CarouselSlideType } from '@/app/components/Carousel'

import { useState, useEffect } from 'react'

const Form = () => {
    const [variant, setVariant] = useState("primary")

    return (
        <div className='flex-center flex-col h-full gap-y-20 p-4'>
            <Input placeholder="Name" label="We are the Hagz team and you are..."/>
            <div>
                <span className='block text-center'>& you're using Hagz as a:</span>
                <div className='flex items-center gap-x-4 mt-4'>
                    <Button label="A Player" variant={variant == "primary" ? "secondary" : "primary"} onClick={() => variant == "secondary" ? setVariant("primary") : setVariant("secondary")}/>
                    <span className='px-4'>or</span>
                    <Button label="An Owner" variant={variant} onClick={() => variant == "primary" ? setVariant("secondary") : setVariant("primary")}/>
                </div>
            </div>
            <div className='flex justify-between items-center w-full gap-x-4'>
                <span>Do we have permission to use location? (Hagz will work a lot better)</span>
                <select className='bg-transparent text-center outline-none border-b-[1px] border-primary px-4 py-2'>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                </select>
            </div>
        </div>
    )
}

const slides: CarouselSlideType[] = [
    {
        title: "Hello!",
        description: "Welcome to Hagz. We're so excited to have you on board. Let's get started!",
        image: "/"
    },
    {
        title: "Why Hagz?",
        description: "Simply said, because Hagz saves you time, money, and effort. We all know the feeling of having to search for available pitches and cancelling last minute. We're here to make your life easier.",
        image: "/"
    },
    {
        title: "But, Enough About Us...",
        description: "We also want to learn more about you. What is your name? Are you a player or do you manage a pitch? We want to know it all.",
        child: <Form/>
    },
    {
        title: "How Does Hagz Work?",
        description: "Hagz is for everybody. Whether you're a professional or amateur player, a manager, or a coach, we've got you covered. We offer a simple system that cater to your needs.",
        image: "/"
    },
    {
        title: "Next Steps",
        description: "So, are you ready to get started? Let's create an account and get you on your way to a hassle-free experience.",
        image: "/"
    },
]

const labels = ["Welcome", "Introduction", "Quick Info", "Features", "Continue"]

export default function Onboarding () {
    const [active, setActive] = useState(0);

    // Allow user to traverse through slides using arrow keys
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                // If not on the last slide, increment the step
                if (active < slides.length - 1) {
                    setActive(active + 1)
                }
            } else if (e.key === 'ArrowLeft') {
                // If not on the first slide, decrement the step
                if (active > 0) {
                    setActive(active - 1)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [active])

    return (
        <div className="h-screen bg-secondary p-4">
            <div>
                <Progress current={active} labels={labels}/>
                <Carousel step={active} slides={slides}/>
            </div>
            <div className='flex absolute bottom-4 right-4 gap-x-4'>
                {
                    // If on the first slide, allow user to skip
                    active === 0 &&
                    <Button label="Skip" variant="inverted" onClick={() => setActive(slides.length - 1)}/>
                }
                {
                    // If not on the first slide, allow user to traverse backwards
                    active > 0 &&
                    <Button label="Back" variant="primary" onClick={() => setActive(active - 1)}/>
                }
                {
                    // If not on the last slide, allow user to traverse forwards
                    active < slides.length - 1 &&
                    <Button label="Next" variant="secondary" onClick={() => setActive(active + 1)}/>
                }
                {
                    // If on the last slide, give user option to create account
                    active === slides.length - 1 &&
                    <Link href="/sign-up">
                        <Button label="Let's Get Started!" variant="secondary"/>
                    </Link>
                }
            </div>
        </div>
    )
}