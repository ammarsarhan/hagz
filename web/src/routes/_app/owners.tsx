import { createFileRoute, Link } from '@tanstack/react-router'
import Badge from '#/components/shared/Badge'
import Button from '#/components/shared/Button';
import IconCard from '#/components/app/IconCard'
import StandardCard from '#/components/app/StandardCard';
import { TbArrowRight, TbBrandWhatsapp, TbCurrentLocationFilled, TbGraph, TbListCheck, TbLiveView, TbMoodSmile, TbSoccerField, TbTableHeart, TbUserPlus, TbUsersGroup } from 'react-icons/tb'
import Pitch from "#/assets/samples/pitch.jpg";

export const Route = createFileRoute('/_app/owners')({
  component: RouteComponent,
})

function RouteComponent() {
    const steps = [
        {
            icon: <TbUserPlus/>,
            title: "Step 1: Create your account in just a few minutes",
            description: "Create your account with just your name and phone number, we'll handle the rest for you."
        },
        {
            icon: <TbSoccerField/>,
            title: "Step 2: Fill out the pitch details form",
            description: "This is a simple four-step form that should take a maximum of 10 minutes to fill out."
        },
        {
            icon: <TbListCheck/>,
            title: "Step 3: Wait for a member of our team to get in touch with you",
            description: "We will run an in-person venue quality check to ensure information is up to date."
        },
        {
            icon: <TbLiveView/>,
            title: "Step 4: Go live and accept bookings",
            description: "Make any final changes to your pitch and go live to start accepting bookings!"
        },
    ]

    return (
        <>
            <main className='flex-center flex-col gap-y-16 h-screen'>
                <div className='flex-center flex-col gap-y-6 max-w-1/2 text-center'>
                    <Badge>Get your pitch up and running in less than 24 hours.</Badge>
                    <h1 className='font-medium text-4xl'>We've got an entire process dedicated to ensuring the smoothest experience for both you and your customers.</h1>
                    <p className='text-gray-500'>Our flow is designed to have you up and running with as least friction as possible!</p>
                </div>
                <div className='flex items-center gap-x-8'>
                    {
                        steps.map((step, index) => <IconCard icon={step.icon} title={step.title} description={step.description} key={index}/>)
                    }
                </div>
            </main>
            <section className='h-screen pt-20'> 
                <div className='px-8 py-16 h-full flex flex-col gap-y-10'>
                    <div className='flex flex-col gap-y-3 max-w-1/2'>
                        <h1 className='text-4xl font-medium'>Why use Hagz?</h1>
                        <p className='text-gray-500'>Because we've taken into account every single use-case <TbMoodSmile className='inline size-5 -mt-0.5 mx-px'/> to make integration with us a non-negotiable for you.</p>
                        <p className='text-gray-500'>No, seriously, look:</p>
                    </div>
                    <div className='grid grid-cols-3 grid-rows-2 h-full gap-6'>
                        <div className='relative bg-linear-to-br from-primary to-primary/75 rounded-md p-5 flex items-end'>
                            <div className='top-5 left-5 absolute size-6 rounded-full bg-secondary flex-center'>
                                <span className='text-white text-xs'>1</span>
                            </div>  
                            <div className='flex flex-col gap-y-1'>
                                <h2 className='font-medium text-lg'>Booking Options</h2>
                                <p className='text-sm'>Hagz offers many different booking options to cater to all audiences/users, whether that be a <span className='text-nowrap'><div className='size-4 border rounded-full flex-center inline-flex! mx-0.5 text-xs'>1</div> standard booking,</span><span className='text-nowrap'><div className='size-4 border rounded-full flex-center inline-flex! mx-0.5 text-xs'>2</div> recurring booking,</span> or <span className='text-nowrap'><div className='size-4 border rounded-full flex-center inline-flex! mx-0.5 text-xs'>3</div> group booking.</span></p>
                            </div>
                        </div>
                        <div className='relative border bg-linear-to-br from-white to-gray-100 border-gray-200 rounded-md px-4 py-5 flex items-end'>
                            <div className='top-5 left-5 absolute flex items-center gap-x-2 h-fit'>
                                <div className='size-6 rounded-full bg-primary flex-center'>
                                    <span className='text-black text-xs'>2</span>
                                </div>
                                <span className='text-base font-medium'>Pricing</span>
                            </div>
                            <div className='flex flex-col gap-y-4'>
                                <div className='grid grid-cols-3 gap-x-6 w-full'>
                                    <div className='text-center flex-center flex-col gap-y-0.75'>
                                        <span className='text-base font-medium'>*Base Hours</span>
                                        <p className='text-xs'>This is your normal pricing across the day.</p>
                                    </div>
                                    <div className='text-center flex-center flex-col gap-y-0.75'>
                                        <span className='text-base font-medium'>Peak Hours</span>
                                        <p className='text-xs'>Increased pricing during high-demand hours.</p>
                                    </div>
                                    <div className='text-center flex-center flex-col gap-y-0.75'>
                                        <span className='text-base font-medium'>Discount Hours</span>
                                        <p className='text-xs'>Reduced pricing for less-demanded hours.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='relative bg-linear-to-br from-primary to-primary/75 rounded-md p-5 flex items-end'>
                            <div className='top-5 left-5 absolute size-6 rounded-full bg-secondary flex-center'>
                                <span className='text-white text-xs'>3</span>
                            </div>  
                            <div className='flex flex-col gap-y-1'>
                                <h2 className='font-medium text-lg'>Pitch Layout</h2>
                                <p className='text-sm'>Our platform is built to take into account every possible pitch layout. Full flexibility over <span className='underline'>every ground</span> in your venue, because each ground is treated independently.</p>
                            </div>
                        </div>
                        <div className='relative border bg-linear-to-br from-white to-gray-100 border-gray-200 rounded-md px-4 py-5 flex items-end'>
                            <div className='top-5 left-5 absolute flex items-center gap-x-2 h-fit'>
                                <div className='size-6 rounded-full bg-primary flex-center'>
                                    <span className='text-black text-xs'>4</span>
                                </div>
                                <span className='text-base font-medium'>Payment Methods</span>
                            </div>
                            <div className='grid grid-cols-3 gap-x-6 w-full'>
                                <div className='text-center flex-center flex-col gap-y-0.75'>
                                    <span className='text-base font-medium'>Cash</span>
                                    <p className='text-xs'>Pay at 300,000+ Fawry machines nationwide. No card needed.</p>
                                </div>
                                <div className='text-center flex-center flex-col gap-y-0.75'>
                                    <span className='text-base font-medium'>Credit Card</span>
                                    <p className='text-xs'>Fast, secure payments via Visa & Mastercard.</p>
                                </div>
                                <div className='text-center flex-center flex-col gap-y-0.75'>
                                    <span className='text-base font-medium'>Mobile Wallet</span>
                                    <p className='text-xs'>Instant payments via Vodafone Cash, Orange Money, and more.</p>
                                </div>
                            </div>
                        </div>
                        <div className='relative border bg-linear-to-br from-white to-gray-100 border-gray-200 rounded-md px-4 py-5 flex items-end'>
                            <div className='top-5 left-5 absolute flex items-center gap-x-2 h-fit'>
                                <div className='size-6 rounded-full bg-primary flex-center'>
                                    <span className='text-black text-xs'>5</span>
                                </div>
                                <span className='text-base font-medium'>Refunds</span>
                            </div>
                            <div className='flex flex-col gap-y-1'>
                                <h2 className='font-medium text-lg'>Define <span className='underline'>Your</span> Policy</h2>
                                <p className='text-sm'>The system was built to consider the fact that every owner may want to implement a different refund policy. You have the flexibility to choose the refund window and the amount the user receives back.</p>
                            </div>
                        </div>
                        <div className='relative bg-linear-to-br from-primary to-primary/75 rounded-md p-5 flex items-end'>
                            <div className='top-5 left-5 absolute size-6 rounded-full bg-secondary flex-center'>
                                <span className='text-white text-xs'>6</span>
                            </div>  
                            <div className='flex flex-col gap-y-1'>
                                <h2 className='font-medium text-lg'>Settings</h2>
                                <p className='text-sm'>And if that isn't enough, we offer a plethora of additional settings to make sure that all of your edge cases are covered: <br/> <span className='text-primary-muted'>Manual approval, payment deadlines, enabling rescheduling, limiting payment methods, setting deposits, etc...</span></p>
                            </div>
                        </div>
                    </div>
                </div> 
            </section>
            <section className='h-screen grid grid-cols-2 pt-20'>
                <div className='px-8 flex flex-col justify-around gap-y-10 py-12'>
                    <div className='flex flex-col gap-y-2 border-gray-100'>
                        <h1 className='text-4xl font-medium'>That's not to mention</h1>
                        <p className='text-gray-500'>We've developed and integrated <span className='underline'>dozens</span> of features to make sure your pitch is discoverable, locatable, and managable.</p>
                        <p className='text-gray-500'>All at absolutely no additional price.<br/>For free.</p>
                    </div>
                    <img src={Pitch} alt="" className='h-72 object-cover' />
                </div>
                <div className='grid grid-cols-2 grid-rows-4 gap-6 p-8'>
                    <StandardCard icon={<TbSoccerField/>} title='Filter Searching' description='Our platform allows the user to find your pitch by searching with every filter possible.'/>
                    <StandardCard icon={<TbCurrentLocationFilled/>} title='Location Searching' description='Users will always find your pitch as long as you exist within a search radius around them.'/>
                    <StandardCard icon={<TbTableHeart/>} title='Consistent Bookings' description='Hagz is designed to never allow your pitch to double book again.'/>
                    <StandardCard icon={<TbGraph/>} title='Revenue Analytics' description='The system automatically generates analytics reports to help you cater better to customers.'/>
                    <StandardCard icon={<TbBrandWhatsapp/>} title='Channel Integrations' description='Accept bookings through every single channel possible: WhatsApp, phone, manual, or walk-ins. We&apos;ve taken it all into account.'/>
                    <StandardCard icon={<TbUsersGroup/>} title='Teams & Permissions' description='You can add up to 20 staff members to help you manage your pitch. And you can pick exactly what they are allowed to see.'/>
                    <StandardCard icon={<TbSoccerField/>} title='Payment Channels' description='Any booking that comes through Hagz will always be paid for. In full. Always.' link="/product/owners"/>
                </div>
            </section>
            <section className='h-screen pt-20'>
                <div className='h-full text-center flex-center flex-col gap-y-16 px-8'>
                    <div className='flex flex-col gap-y-3 max-w-1/2'>
                        <h1 className='font-medium text-4xl'>Still not convinced?</h1>
                        <p className='text-gray-500'>We understand making the decison to switch to a digital system can be scary. We've set up multiple channels so we can answer any remaining questions you may have.</p>
                    </div>
                    <div className='grid grid-cols-4 gap-x-8 text-left'>
                        <div className='flex flex-col gap-y-2 px-4 border-r border-gray-200'>
                            <h2 className='text-base font-medium'>Chat to sales</h2>
                            <p className='text-gray-500 text-sm'>Need assistance with making the switch? Speak to our team.</p>
                            <span className='text-sm font-semibold'>sales@hagz.com</span>
                        </div>
                        <div className='flex flex-col gap-y-2 px-4 border-r border-gray-200'>
                            <h2 className='text-base font-medium'>Email support</h2>
                            <p className='text-gray-500 text-sm'>Email us and we'll get back to you within a few hours.</p>
                            <span className='text-sm font-semibold'>support@hagz.com</span>
                        </div>
                        <div className='flex flex-col gap-y-1.5 px-4 border-r border-gray-200'>
                            <h2 className='text-base font-medium'>Call us</h2>
                            <p className='text-gray-500 text-sm mb-4'>Sun-Sat, excluding Fri, 9:00 AM-9:00 PM. </p>
                            <span className='text-sm font-semibold'>+20 111 111 1111</span>
                            <span className='text-sm font-semibold'>+20 222 222 2222</span>
                        </div>
                        <div className='flex flex-col gap-y-2 px-4'>
                            <h2 className='text-base font-medium'>Shoot us a DM</h2>
                            <p className='text-gray-500 text-sm'>Find us on Instagram, we reply quick over there.</p>
                            <a href="https://www.instagram.com/hagz.co" target="_blank" className='text-sm font-semibold'>@hagz.co</a>
                        </div>
                    </div>
                    <span>or</span>
                    <Link to="/auth/sign-up">
                        <Button className='bg-primary hover:bg-primary/75 group'>
                            <span>Try it, completely free of charge</span>
                            <TbArrowRight className='group-hover:-rotate-45 transition-all' />
                        </Button>
                    </Link>
                </div>
            </section>
        </>
    )
}
