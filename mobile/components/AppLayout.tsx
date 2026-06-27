import { useAuth } from "@/context/AuthContext";
import { SplashScreen } from "expo-router";
import { ReactNode, useEffect } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
    const { isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading) SplashScreen.hideAsync();
    }, [isLoading]);

    if (isLoading) return null;

    return <>{children}</>;
}