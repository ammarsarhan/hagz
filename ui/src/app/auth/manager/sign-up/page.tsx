import Form from "@/app/auth/manager/sign-up/Form";
import { QueryClient } from "@tanstack/react-query";
import { fetchInvitation } from "@/app/utils/api/server";
import Link from "next/link";
import ErrorView from "@/app/components/base/Error";

export default async function SignUp({ searchParams } : { searchParams: Promise<{ token?: string }>}) {
    const { token } = await searchParams;

    if (!token) {
        return <ErrorView title="Could not fetch manager invitation data" message="An invalid or undefined token has been provided by the query parameters. Please use a valid link and try again."/>
    }
    
    const queryClient = new QueryClient();

    const data = await queryClient.fetchQuery({
        queryKey: ['invitation', token],
        queryFn: () => fetchInvitation(token)
    });

    if (!data) return <ErrorView title="Could not fetch manager invitation data" message="An invalid or undefined token has been provided by the query parameters. Please use a valid link and try again."/>

    return (
        <div className="h-screen grid grid-cols-2 gap-x-4 p-4">
            <div className="relative flex flex-col items-center justify-center gap-y-8">
                <div className="flex flex-col gap-y-0.5 text-center">
                    <h1 className="text-xl font-medium">Sign Up As A Manager</h1>
                    <p className="text-gray-500 text-[0.8125rem] w-96">Create an account as a manager to help owners handle pitch bookings and revenue.</p>
                </div>
                <Form data={data}/>
                <span className="absolute bottom-4 text-[0.8125rem] text-gray-500">Already have an account? <Link href="/auth/sign-in" className="text-blue-700 hover:underline">Sign in</Link></span>
            </div>
            <div className="h-full bg-black rounded-xl"></div>
        </div>
    )
}