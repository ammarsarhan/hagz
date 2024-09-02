import NavLink from '@/app/components/NavLink'
import Button from '@/app/components/Button'

export default function Navigation() {
    return (
        <nav className="flex items-center justify-between border-b-[1px] border-light-gray py-5 px-10">
            <div className='flex items-center'>
                <NavLink href="/"><span className='text-lg font-semibold'>حجز</span></NavLink>
            </div>
            <div className='flex gap-x-10'>
                <div className="flex-center gap-x-10 text-sm text-dark-gray">
                    <NavLink href="/">Home</NavLink>
                    <NavLink href="/search">Search</NavLink>
                    <NavLink href="/dashboard">Dashboard</NavLink>
                    <NavLink href="/policy">Policy</NavLink>
                </div>
                <div className="flex items-center justify-end gap-x-4">
                    <NavLink href="/auth/sign-in"><Button variant="secondary">Sign In</Button></NavLink>
                    <NavLink href="/auth/register"><Button variant="primary">Register</Button></NavLink>
                </div>
            </div>
        </nav>
    )
}