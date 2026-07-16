import { Alert, Text } from "react-native";
import ErrorView from "@/components/shared/ErrorView";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

export default function UserBoundary() {
    const { signOut } = useAuth();
    const [loading, setLoading] = useState(false);

    const handlePress = async () => {
        if (loading) return;
        setLoading(true);

        try { await signOut(); } 
        catch {
            Alert.alert(
                "Sign out failed",
                "Couldn't sign you out. Please try again."
            );
        }
        finally {
            setLoading(false);
        }
    } 

    return (
        <ErrorView 
            title="Dashboard access isn't available"
            description="This account is intended for the user app. Please sign in there to access your account."
            actionProps={{ 
                children: <Text className="font-medium text-primary">Sign Out</Text>, 
                className: "px-0 py-1 self-start",
                onPress: handlePress,
                loading
            }}
        />
    )
}