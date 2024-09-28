import { Menu } from 'lucide-react'

import NavLink from '@/components/ui/NavLink'
import Button from '@/components/ui/Button'

export default function Navigation() {
    return (
        <nav className="sticky top-0 bg-white flex items-center justify-between border-b-[1px] border-light-gray py-5 px-10 z-50 overflow-x-hidden">
            <div className='flex items-center'>
                <NavLink href="/"><span className='text-lg font-semibold text-primary-green'>حجز</span></NavLink>
            </div>
            <div className='hidden lg:flex gap-x-10'>
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
            <div className='flex lg:hidden gap-x-5'>
                <div className="hidden sm:flex items-center justify-end gap-x-4">
                    <NavLink href="/auth/sign-in"><Button variant="secondary" className='text-xs'>Sign In</Button></NavLink>
                    <NavLink href="/auth/register"><Button variant="primary" className='text-xs'>Register</Button></NavLink>
                </div>
                <div className="flex-center gap-x-10 text-sm text-dark-gray">
                    <Menu className='w-5 h-5 cursor-pointer'/>
                </div>
            </div>
        </nav>
    )
}