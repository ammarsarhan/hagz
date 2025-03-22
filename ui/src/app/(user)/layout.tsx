import { UserNavigation } from "@/components/navigation";

export default function UserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="h-screen flex flex-col">
      <UserNavigation/>
      {children}
    </main>
  );
}
