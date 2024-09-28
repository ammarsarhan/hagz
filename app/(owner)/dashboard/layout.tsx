import Sidebar from '@/components/dashboard/Sidebar';

export default function DashboardLayout ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='flex flex-1'>
      <Sidebar/>
      <main className='flex flex-col flex-1 gap-2 px-10 py-5 h-screen overflow-y-scroll'>
        {children}
      </main>
    </div>
  );
}
