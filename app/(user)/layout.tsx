import Navigation from "@/components/Navigation";

export default function UserLayout ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navigation/>
      {children}
    </>
  );
}
