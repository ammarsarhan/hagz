import { AuthNavigation } from "@/components/navigation";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AuthNavigation/>
      {children}
    </>
  );
}
