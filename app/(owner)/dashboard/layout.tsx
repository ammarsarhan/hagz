import Sidebar from '@/components/Sidebar';

export default function DashboardLayout ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='flex'>
      <Sidebar/>
      {children}
    </div>
  );
}
