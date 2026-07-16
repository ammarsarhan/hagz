import Button from "@/components/shared/Button";
import { useAuth } from "@/context/AuthContext";
import { client } from "@/lib/client";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getErrorMessage, parseClientError } from "@/lib/error";

export default function Transfer() {
    const { setUser } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleTransfer = async () => {
        if (loading) return;
        setLoading(true);

        try {
            const res = await client.app.profile.transfer.$post({ json: { role: "MANAGER" }});
            
            if (res.ok) {
                const { data } = await res.json();
                const { profile } = data;

                setUser(profile);
                return;
            };

            const error = await parseClientError(res);
            let message = error.message;
    
            if (error.fields?.length) {
                message = error.fields.map(f => f.message).join("\n");
            }
    
           message = getErrorMessage(error);
           Alert.alert("Account transfer failed", message);
        } catch (error) {
            console.log(error);
            Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView className="flex-1 p-6">
            <View className="mb-3">
                <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={() => router.back()}>
                    <IconChevronLeft size={18}/>
                </Pressable>
            </View>
            <View className="gap-y-1 py-2 mb-10">
                <Text className="text-3xl font-semibold">Change Role</Text> 
                <Text className="text-gray-500">Switch your account role.</Text> 
                <View className="py-8">  
                    <Button className="bg-primary border-primary" loading={loading} onPress={handleTransfer}>
                        <Text className="text-white font-medium">Transfer Account</Text>
                    </Button>
                </View>
                <Text className="text-gray-500 text-sm">
                    Changing your account to a manager account will require that you have a valid pending invitation associated with this phone number to join a venue.
                </Text>
            </View>
        </SafeAreaView>
    )
}