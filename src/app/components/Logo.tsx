import Image from 'next/image'
import Link from 'next/link'

export default function Logo () {
    return (
        <Link href="/">        
            <div className="flex items-center">
                <Image width={20} height={20} src={''} alt='Hagz Logo' className='rounded-full'></Image>
                <span className='mx-4 font-bold'>Hagz.</span>
            </div>
        </Link>
    )
}