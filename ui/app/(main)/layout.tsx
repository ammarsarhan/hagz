import Navigation from "@/app/components/base/Navigation";
import { getUser } from "@/app/utils/api/cookies";

export default async function MainLayout({ children } : { children: React.ReactNode }) {
    const user = await getUser();

    return (
        <>
            <Navigation user={user}/>
            {children}
        </>
    )
}