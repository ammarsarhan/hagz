"use client"

import { DashboardContextProvider } from '@/context/useDashboardContext';
import useAuthContext from '@/context/useAuthContext';
import Sidebar from '@/components/dashboard/Sidebar';

import { useRouter } from 'next/navigation';

export default function DashboardLayout ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = useAuthContext();
  const router = useRouter();

  if (context.data.role !== 'Owner') {
    router.push('/auth/owner/sign-in');
    return;
  }

  return (
    <DashboardContextProvider>
      <div className='flex flex-1'>
        <Sidebar/>
        <main className='flex flex-col flex-1 gap-2 px-5 sm:px-10 py-5 h-screen overflow-y-scroll'>
          {children}
        </main>
      </div>
    </DashboardContextProvider>
  );
}
