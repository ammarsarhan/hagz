import Avatar from '#/components/shared/Avatar'
import Badge from '#/components/shared/Badge'
import Button from '#/components/shared/Button'
import Input from '#/components/shared/Input'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { TbBallFootball, TbBrandFacebook, TbBrandInstagram, TbBrandTiktok } from 'react-icons/tb'

export const Route = createFileRoute('/waitlist')({
    component: RouteComponent,
})

function RouteComponent() {
    const [phone, setPhone] = useState("");

    return (
        <div className='relative w-screen h-screen flex-center flex-col overflow-clip'>
            <TbBallFootball className='absolute -bottom-24 -right-24 size-96 text-primary-muted opacity-5 z-0'/>
            <div className="flex-center size-10 rounded-md bg-primary mb-14">
                <TbBallFootball className="size-6.5" strokeWidth={2}/>
            </div>
            <div className='flex-center flex-col gap-y-4 text-center mb-14'>
                <Badge>Hagz is launching soon</Badge>
                <h1 className='font-medium text-4xl'>Hagz is almost here, launching in Alexandria!</h1>
                <p className='text-base text-gray-500'>We're partnering with 30+ sport venues across the governorate, <br/> and making all of your favorite grounds cheaper!</p>
            </div>
            <div className='p-4 rounded-md border border-gray-200 bg-linear-to-b from-transparent to-gray-50 w-xl mb-14 z-20'>
                <div className='flex items-center'>
                    <Avatar label={"A"}/> 
                    <Avatar label={"Y"} className='-ml-2'/> 
                    <Avatar label={"D"} className='-ml-2'/> 
                    <Avatar label={"+1.2K"} className='-ml-2 text-[0.6rem]!'/> 
                </div>
                <div className='flex flex-col gap-y-1 my-6'>
                    <h2 className='text-xl font-medium'>Join the waitlist and get exclusive perks</h2>
                    <p className='text-sm text-gray-500'>Get your next booking <span className='underline'>for free</span> with us if you join the waitlist right now.</p>
                </div>
                <div className='flex items-center gap-x-1'>
                    <Input type="phone" placeholder='Phone number' value={phone} onChange={(e) => setPhone(e.target.value)} className='flex-1 py-2!'/>
                    <Button className='bg-primary hover:bg-primary/75'>
                        <span className='text-sm font-medium'>Subscribe</span>
                    </Button>
                </div>
            </div>
            <div className='flex items-center gap-x-2'>
                <span className='text-sm mr-1.5'>Find us</span>
                <a href="https://www.instagram.com/hagz.co">
                    <TbBrandInstagram className='size-5'/>
                </a>
                <a href="https://www.tiktok.com/hagz.co">
                    <TbBrandTiktok className='size-5'/>
                </a>
            </div>
            <span className='absolute bottom-4 text-gray-500 text-xs'>© Hagz 2026. Terms and conditions apply.</span>
        </div>
    )
}
