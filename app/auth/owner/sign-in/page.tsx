"use client"

import { FormEvent, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { decode } from 'jsonwebtoken';
import { OwnerAccessTokenType } from '@/utils/types/tokens';
import useAuthContext from '@/context/useAuthContext';

import Button from '@/components/ui/Button';
import Loading from '@/components/ui/Loading';
import Link from 'next/link';

export default function SignIn () {
    const [error, setError] = useState('');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [pending, setPending] = useState(false);
    const [unveil, setUnveil] = useState(false);

    const authContext = useAuthContext();
    const router = useRouter();

    const handleError = (message: string) => {
        setError(message);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
            setError("");
            timeoutRef.current = null;
        }, 5000);
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setPending(true);

        const handleLogin = async () => {
            const request = await fetch('/api/auth/owner/sign-in', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await request.json();

            if (!data.token) {
                handleError(data.message);
                setPending(false);
                return;
            }

            const decoded = decode(data.token) as OwnerAccessTokenType;

            authContext.actions.setAccessToken(data.token);
            authContext.actions.setUser({name: decoded.name, email: decoded.email, id: decoded.id});
            authContext.actions.setRole(decoded.role);

            router.push('/dashboard');
        }

        try {
            handleLogin();
        } catch (error) {
            handleError("An unexpected error has occurred. Please try again.")
            setPending(false);
            return;
        }
    }

    if (authContext.data.role === 'Owner') {
        return (
            <div className='h-screen flex-center text-sm'>
                <span>Handle wanting to sign in while already signed in.</span>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className='w-full h-screen flex-center flex-col gap-y-4'>
            {error && <h6 className="text-red-600 text-sm w-3/4 text-center">{error}</h6>}
            <div className="flex-center flex-col gap-y-2 text-center w-4/5">
                <h1 className="text-2xl font-medium">Sign In</h1>
                <h6 className="text-sm text-dark-gray">Log into Hagz as an owner to manage your pitches and reservations</h6>
            </div>
            <div className="flex-center flex-col text-sm gap-y-6 px-16 my-4 w-full lg:w-1/2" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-2 flex-1 w-full">
                    <span className="text-dark-gray">Email Address</span>
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email" 
                        placeholder="Email" 
                        className="py-2 px-3 border-[1px] rounded-lg max-w-1/2"
                        required
                    />
                </div>
                <div className="flex flex-col gap-2 flex-1 w-full">
                    <span className="text-dark-gray">Password</span>
                    <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={unveil ? "text" : "password"} 
                        placeholder="Password" 
                        className="py-2 px-3 border-[1px] rounded-lg max-w-1/2"
                        required 
                    />
                    <div className='flex gap-x-2 items-center mt-2'>
                        <input type="checkbox" checked={unveil} onChange={() => setUnveil(!unveil)} />
                        <span onClick={() => setUnveil(!unveil)}>Show Password</span>
                    </div>
                </div>
                <div className='flex flex-col sm:flex-row justify-between gap-x-8 gap-y-2 mt-2'>
                    <Link className='underline h-fit w-fit' href={''}>Forgot your password?</Link>
                    <p className='flex-1 text-dark-gray'>Note: entering a wrong password more than <span className='text-black'>5 times</span> will result in a temporary lock on log-in attempts. If you can not remember your account password, please use the link.</p>
                </div>
            </div>
            <div className="flex gap-x-4">
                <Button variant={pending ? "pending" : "color"} className="!px-20" type="submit">
                    Login
                </Button>
            </div>
        </form>
    )
}