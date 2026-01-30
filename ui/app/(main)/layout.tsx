import Navigation from "@/app/components/base/Navigation";

export default function MainLayout({ children } : { children: React.ReactNode }) {
    return (
        <>
            <Navigation/>
            {children}
        </>
    )
}