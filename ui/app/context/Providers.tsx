import { ReactQueryProvider } from '@/app/context/Query';

export default async function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ReactQueryProvider>
            {children}
        </ReactQueryProvider>
    )
};
