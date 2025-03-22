import { UserNavigation } from "@/components/navigation";

export default function UserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col h-screen">
      <UserNavigation/>
      {children}
    </div>
  );
}
