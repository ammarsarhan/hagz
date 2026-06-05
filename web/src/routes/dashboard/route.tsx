import Button from '#/components/shared/Button';
import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { TbArrowLeft, TbBallFootball, TbTransfer } from 'react-icons/tb';

export const Route = createFileRoute('/dashboard')({
  component: RouteComponent,
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/auth/sign-in" });
    // Todo: Uncomment this when we can generate OTPs for verification.
    // if (!context.user.isVerified) throw redirect({ to: "/auth/verify/send" });

    return { user: context.user, locations: context.locations };
  }
})

function RouteComponent() {
    const context = Route.useRouteContext();

    if (context.user.preferences.role === "USER") {
        return (
            <div className='w-screen h-screen fixed flex-center flex-col gap-y-4'>
                <Link to="/">
                    <div className="flex-center size-10 rounded-md bg-gray-200">
                        <TbBallFootball className="size-6.5" strokeWidth={2}/>
                    </div>
                </Link>
                <div className='my-6 flex-center text-center flex-col gap-y-4 max-w-md'>
                    <h1 className='text-3xl font-medium'>You are not allowed to access this resource</h1>
                    <p className='text-gray-500 text-sm'>Your account was registered as a user account. Please transfer to an owner account first before attempting to access the dashboard.</p>
                </div>
                <div className='flex items-center gap-x-4'>
                    <Link to="/">
                        <Button className='border-gray-200! bg-gray-50 hover:bg-gray-100'> 
                            <TbArrowLeft />
                            <span className='text-sm'>Back home</span>
                        </Button>
                    </Link>
                    <Link to="/account/settings">
                        <Button className='bg-black hover:bg-black/75 text-white'> 
                            <TbTransfer />
                            <span className='text-sm'>Transfer account</span>
                        </Button>
                    </Link>
                </div>
                <span className='absolute bottom-4 text-xs text-gray-500'>© Hagz 2026. All rights reserved.</span>
            </div>
        )
    }

    return <Outlet />  
}
