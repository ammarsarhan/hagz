import { UserNavigation } from "@/components/navigation";

export default function UserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <UserNavigation/>
      {children}
    </>
  );
}
