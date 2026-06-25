import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { IconSearch } from '@tabler/icons-react';
import Logo from '#/assets/logos/primary.svg';

export default function Navigation() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <> 
            <nav className="h-18 flex flex-col fixed top-0 w-full bg-white">
                <div className="h-1 bg-primary"></div>
                <div className="relative flex flex-1 w-full items-center justify-between px-4">
                    <div className='flex items-center gap-x-6'>
                        <Link to="/">
                            <img src={Logo} alt="Hagz" className='size-10 rounded-md' />
                        </Link>
                        <Link to="/pitches/search" className='transition-all' inactiveProps={{ className: "text-muted hover:text-black" }} activeProps={{ className: "text-black hover:underline" }} activeOptions={{ exact: true }}>
                            <span>Explore</span>
                        </Link>
                        <Link to="/product" className='transition-all' inactiveProps={{ className: "text-muted hover:text-black" }} activeProps={{ className: "text-black hover:underline" }} activeOptions={{ exact: true }}>
                            <span>How it works</span>
                        </Link>
                    </div>
                    <div className='absolute top-1/2 left-1/2 -translate-1/2 w-96 bg-gray-100 hover:bg-gray-200/75 transition-all h-11 rounded-full cursor-pointer flex items-center gap-x-3 px-4 py-2'>
                        <IconSearch size={16}/> 
                        <span className='text-muted text-sm'>Search for venues...</span>
                    </div>
                </div>
            </nav>
        </>
    )
}