import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "@/context/AuthContext";
import { ReactNode, useEffect } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
    const { isLoading, user } = useAuth();

    useEffect(() => {
        if (!isLoading) {
            SplashScreen.hideAsync();
        }
    }, [isLoading]);

    if (isLoading) return null;

    return <>{children}</>;
}