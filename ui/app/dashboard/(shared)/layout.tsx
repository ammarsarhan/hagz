import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect } from "next/navigation";

import ErrorView from "@/app/components/base/ErrorView";
import keys from "@/app/utils/api/keys";
import getTokens from "@/app/utils/api/cookies";
import { query } from "@/app/utils/api/base";
import { RequestError } from "@/app/utils/api/error";
import { DashboardStateType } from "@/app/utils/types/dashboard";

import { FaExclamation, FaLock } from "react-icons/fa6";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient();
    const header = await getTokens();

    let data: DashboardStateType;

    try {
        data = await queryClient.fetchQuery({
            queryKey: keys.dashboard,
            queryFn: async () => await query<DashboardStateType>("/dashboard", {
                headers: header ? { Cookie: header } : {}
            })
        });
    } catch (error: unknown) {
        const { status, message } = error as RequestError;

        switch (status) {
            case 401:
                redirect("/auth/sign-in");
            case 403:
                return (
                    <ErrorView 
                        icon={<FaLock className="size-10"/>} 
                        title={"Your account has not been verified yet."} 
                        message={"To protect your account and ensure platform security, we require account verification. Please verify your account to continue."} 
                        action={"Verify account"} 
                        href={"/auth/verify"}
                        error={`Error: (${status}) ${message}`}
                    />
                )
            default:
                return (
                    <ErrorView 
                        icon={<FaExclamation className="size-10"/>} 
                        title={"An error has occurred."} 
                        message={message} 
                        action={"Back to home"} 
                        href={"/"}
                        error={`Error: (${status}) ${message}`}
                    />
                )
        }
    }

    if (data.permissions.length <= 0) {
        redirect("/dashboard/onboarding");
    };

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            {children}
        </HydrationBoundary>
    );
}