import { useRequiredAuth } from "@/context/AuthContext";
import { client } from "@/lib/client";
import cn from "@/lib/cn";
import { parseClientError, getErrorMessage } from "@/lib/error";
import { IconBrandWhatsapp, IconChevronLeft, IconMail, IconNotification } from "@tabler/icons-react-native";
import { router } from "expo-router";
import { ReactNode, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const NotificationChannel = {
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL'
} as const

export type NotificationChannelType = (typeof NotificationChannel)[keyof typeof NotificationChannel];

interface DrawerProps {
    icon: ReactNode,
    title: string,
    description: string,
    channels: Set<NotificationChannelType>;
    pending: NotificationChannelType | null;
    onToggle: (value: NotificationChannelType) => void;
    value: NotificationChannelType;
}

interface DrawerProps {
    icon: ReactNode,
    title: string,
    description: string,
    channels: Set<NotificationChannelType>;
    pending: NotificationChannelType | null;
    onToggle: (value: NotificationChannelType) => void;
    value: NotificationChannelType;
    disabled?: boolean;
}

const Drawer = ({ icon, title, description, channels, pending, onToggle, value, disabled = false } : DrawerProps) => {
    const loading = pending === value;
    const isAnyLoading = pending !== null;

    return (
        <View className="flex-row items-center gap-x-5 border-b border-gray-100 py-5 px-3 rounded-lg">
            <View className={cn("flex-row items-center gap-x-5 flex-1", disabled && "opacity-40")}>
                {icon}
                <View className="flex-1 gap-y-0.5">
                    <Text className="font-medium">{title}</Text>
                    <Text className="text-sm text-gray-500">{description}</Text>
                </View>
                <View className="w-11 items-center justify-center">
                    {loading ? (
                        <View style={{ transform: [{ scale: 0.8 }] }}>
                            <ActivityIndicator size="small" color="#6B7280" />
                        </View>
                    ) : (
                        <Switch
                            value={channels.has(value)}
                            onValueChange={() => onToggle(value)}
                            disabled={isAnyLoading || disabled}
                            className="scale-90"
                            trackColor={{ false: "#D1D5DB", true: "#1C04EA" }}
                            thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
                            ios_backgroundColor="#D1D5DB"
                        />
                    )}
                </View>
            </View>
        </View>
    )
}
export default function Notifications() {
    const { user, setUser } = useRequiredAuth();

    const [channels, setChannels] = useState<Set<NotificationChannelType>>(
        () => new Set(user.preferences.notifications)
    );
    const [pending, setPending] = useState<NotificationChannelType | null>(null);

    const onToggle = async (value: NotificationChannelType) => {
        if (pending) return;
        if (value === NotificationChannel.EMAIL && !user.email) return;

        const next = new Set(channels);
        if (next.has(value)) {
            next.delete(value);
        } else {
            next.add(value);
        }

        setPending(value);

        try {
            const res = await client.app.profile.preferences.$patch({
                json: { notifications: Array.from(next) },
            });

            if (res.ok) {
                const { data } = await res.json();
                setUser(data.profile);
                setChannels(next);
                return;
            }

            const error = await parseClientError(res);
            Alert.alert(
                "Notification update failed",
                getErrorMessage(error)
            );
        } catch {
            Alert.alert(
                "Connection error",
                "Couldn't connect. Check your connection and try again."
            );
        } finally {
            setPending(null);
        }
    };

    return (
        <SafeAreaView className="flex-1 p-6">
            <View className="mb-3">
                <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={() => router.back()}>
                    <IconChevronLeft size={18}/>
                </Pressable>
            </View>
            <View className="gap-y-1 py-2 mb-6">
                <Text className="text-3xl font-semibold">Notifications</Text> 
                <Text className="text-gray-500">Select your notification delivery channels.</Text> 
            </View>
            <View className="mb-12">  
                <Drawer 
                    icon={<IconNotification strokeWidth={2} color={"#6B7280"} width={28} height={28}/>} 
                    title={"In-App"} 
                    description={"Receive notifications within the app."} 
                    channels={channels}
                    pending={pending}
                    onToggle={onToggle}
                    value={NotificationChannel.IN_APP}
                />
                <Drawer 
                    icon={<IconBrandWhatsapp strokeWidth={2} color={"#6B7280"} width={28} height={28}/>} 
                    title={"WhatsApp"} 
                    description={"Receive notifications through WhatsApp about your pitch, bookings, and team."} 
                    channels={channels}
                    pending={pending}
                    onToggle={onToggle}
                    value={NotificationChannel.WHATSAPP}
                />
                <Drawer 
                    icon={<IconMail strokeWidth={2} color={"#6B7280"} width={28} height={28}/>} 
                    title={"Email"} 
                    description={"Subscribe to our newsletter to recieve early access updates and discounts."} 
                    channels={channels}
                    pending={pending}
                    onToggle={onToggle}
                    value={NotificationChannel.EMAIL}
                    disabled={!user.email}
                />
            </View>
        </SafeAreaView>
    )
};
