import { ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";

// import Navigation from "@/app/components/main/Navigation";
import { fetchSession } from "@/app/utils/api/server";

export default async function MainLayout({ children } : { children: ReactNode }) {
    const queryClient = new QueryClient();

    const { data } = await queryClient.fetchQuery({
        queryKey: ["session"],
        queryFn: fetchSession
    });
    
    const { user } = data;

    return (
        <>
            {/* <Navigation user={user}/> */}
            {children}
        </>
    )
}