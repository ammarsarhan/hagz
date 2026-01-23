import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { ReactQueryProvider } from '@/app/context/Query';
import { AuthContextProvider } from '@/app/context/Auth';
import getTokens, { buildHeaders } from '@/app/utils/api/cookies';
import keys from '@/app/utils/api/keys';
import { query } from '@/app/utils/api/base';

export default async function Providers({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000, 
            },
        },
    });

    const { accessToken, refreshToken } = await getTokens();
    const cookieHeader = buildHeaders(accessToken, refreshToken)

    await queryClient.prefetchQuery({
        queryKey: keys.session,
        queryFn: async () => await query('/auth/session', { 
            headers: cookieHeader ? { Cookie: cookieHeader } : {}
        })
    });

    return (
        <ReactQueryProvider>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <AuthContextProvider>
                    {children}
                </AuthContextProvider>
            </HydrationBoundary>
        </ReactQueryProvider>
    )
};
