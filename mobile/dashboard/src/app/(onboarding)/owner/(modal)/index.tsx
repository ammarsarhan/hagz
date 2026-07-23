import { Pressable, View, Text, ScrollView, Alert, ActivityIndicator } from "react-native";
import ProfilePicture from "@/components/onboarding/ProfilePicture";
import { uploadAvatar } from "@/lib/image/avatar";
import * as ImagePicker from 'expo-image-picker';
import Input from "@/components/shared/Input";
import { useAuth, useRequiredAuth } from "@/context/AuthContext";
import { IconBell, IconChevronRight, IconLanguage, IconLogout, IconTimezone, IconUserCog, IconX } from "@tabler/icons-react-native";
import { Href, Link, router } from "expo-router";
import { ReactNode, useEffect } from "react";
import Animated, { createAnimatedComponent, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useForm } from '@tanstack/react-form';
import { useMutation } from "@tanstack/react-query";
import { useIsDirty } from "@/lib/hooks/useIsDirty";
import { client } from "@/lib/client";
import { ApiError, parseClientError } from "@/lib/error";

const AnimatedPressable = createAnimatedComponent(Pressable);

const Drawer = ({ href, icon, title, description } : { href: Href, icon: ReactNode, title: string, description: string }) => {
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            pressed.value,
            [0, 1],
            ["#FFFFFF", "#F3F4F6"]
        )
    }))

    return (
        <Link asChild href={href}>
            <Pressable
                onPressIn={() => {
                    pressed.value = withTiming(1, { duration: 100 });
                }}
                onPressOut={() => {
                    pressed.value = withTiming(0, { duration: 100 });
                }}
            >
                <Animated.View
                    className="flex-row items-center gap-x-5 border-b border-gray-100 py-5 px-3 rounded-lg"
                    style={animatedStyle}
                >
                    {icon}
                    <View className="flex-1">
                        <Text className="font-medium">{title}</Text> 
                        <Text className="text-gray-500 text-sm">{description}</Text> 
                    </View>
                    <IconChevronRight width={18} height={18} color="#6B7280"/>
                </Animated.View>
            </Pressable>
        </Link>
    )
}

const SignOutDrawer = () => {
    const { signOut } = useAuth();
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            pressed.value,
            [0, 1],
            ["#FFFFFF", "#F3F4F6"]
        )
    }));

    const handlePress = () => {
        Alert.alert(
            "Sign out", 
            "Are you sure you want to leave? You'll be returned to the sign-in screen.",
            [
                {
                    text: "Cancel"
                },
                {
                    text: "Continue",
                    style: "destructive",
                    onPress: signOut
                }
            ]
        )
    };  

    return (
        <Pressable
            onPressIn={() => {
                pressed.value = withTiming(1, { duration: 100 });
            }}
            onPressOut={() => {
                pressed.value = withTiming(0, { duration: 100 });
            }}
            onPress={handlePress}
        >
            <Animated.View
                className="flex-row items-center gap-x-5 py-5 border-b border-gray-100 px-3 rounded-lg"
                style={animatedStyle}
            >
                <IconLogout color="#EF4444"/>
                <View className="flex-1">
                    <Text className="font-medium text-red-500">Sign Out</Text> 
                </View>
            </Animated.View>
        </Pressable>
    )
}

export default function Index() {
    const { user, setUser } = useRequiredAuth();

    const updateProfileMutation = useMutation({
        mutationFn: async (value: { firstName: string; lastName: string; phone: string; email: string }) => {
            const phone = `+20${value.phone}`;
            const email = value.email.trim();

            const payload = {
                ...value,
                phone,
                email: email === "" ? undefined : email,
            };

            const res = await client.app.profile.$patch({ json: payload });

            if (!res.ok) {
                const error = await parseClientError(res);
                throw new ApiError(error);
            }

            const { data } = await res.json();
            return data.profile;
        },
        onSuccess: (profile) => {
            setUser(profile);

            form.reset({
                firstName: profile.firstName,
                lastName: profile.lastName,
                phone: profile.phone.slice(3),
                email: profile.email ?? ""
            });
        },
        onError: (err) => {
            if (err instanceof ApiError) {
                Alert.alert("Profile update failed", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            }
        },
    });

    const uploadAvatarMutation = useMutation({
        mutationFn: uploadAvatar,
        onSuccess: (profile) => {
            setUser(profile);
        },
        onError: (err) => {
            if (err instanceof ApiError) {
                Alert.alert("Avatar upload failed", err.message);
            } else if (err instanceof Error) {
                Alert.alert("Avatar upload failed", err.message);
            } else {
                Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
            }
        },
    });

    const form = useForm({
        defaultValues: {
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone.slice(3),
            email: user.email ?? ""
        },
        onSubmit: async ({ value }) => {
            updateProfileMutation.mutate(value);
        }
    })
    
    const selectAvatar = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (!permission.granted) {
            Alert.alert("Permission required", "Permission to access photos is required to upload image.");
            return;
        };

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            selectionLimit: 1
        });

        if (!result.canceled) {
            uploadAvatarMutation.mutate(result.assets[0]);
        }
    };

    const isSubmitting = updateProfileMutation.isPending;
    const isDirty = useIsDirty(form);

    const isEnabled = isDirty && !isSubmitting;

    const disabledProgress = useSharedValue(isEnabled ? 1 : 0);

    useEffect(() => {
        disabledProgress.value = withTiming(isEnabled ? 1 : 0, { duration: 200 });
    }, [disabledProgress, isEnabled]);

    const saveStyle = useAnimatedStyle(() => ({
        opacity: interpolate(disabledProgress.value, [0, 1], [0.5, 1]),
    }));
    
    return (
        <ScrollView className="p-6">
            <View className="flex-row items-center justify-between pb-3">
                <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={() => router.back()}>
                    <IconX size={18}/>
                </Pressable>
                {/* <AnimatedPressable disabled={!isEnabled} onPress={form.handleSubmit} className="rounded-lg items-center justify-center bg-primary h-11 px-6" style={saveStyle}>
                    {
                        isSubmitting ?
                        <ActivityIndicator size={14} color="#FFFFFF"/> :
                        <Text className="text-white text-sm font-medium">Save</Text>
                    }
                </AnimatedPressable> */}
            </View>
            <View className="gap-y-1 py-2 mb-10">
                <Text className="text-3xl font-semibold">Profile</Text> 
                <Text className="text-gray-500">Manage your account settings and preferences</Text> 
            </View>
            <View className="gap-y-4 mb-12 items-center justify-center">
                <ProfilePicture /> 
                <Pressable onPress={selectAvatar} disabled={uploadAvatarMutation.isPending} className="rounded-lg border border-gray-500 px-4 py-3 items-center justify-center">
                    {
                        uploadAvatarMutation.isPending ? (
                            <ActivityIndicator size={14} color="#000000" />
                        ) : (
                            <Text className="text-sm font-medium">{user.avatarUrl ? "Change photo" : "Upload photo"}</Text>
                        )
                    }
                </Pressable>
            </View>
            <View className="gap-y-6 mb-6">
                <View className="flex-row gap-x-4">
                    <form.Field name="firstName">
                        {
                            (field) => <Input label="First Name" placeholder="First Name" containerClassName="flex-1" value={field.state.value} onChangeText={field.handleChange}/>
                        }
                    </form.Field>
                    <form.Field name="lastName">
                        {
                            (field) => <Input label="Last Name" placeholder="Last Name" containerClassName="flex-1" value={field.state.value} onChangeText={field.handleChange}/>
                        }
                    </form.Field>
                </View>
                <View className="gap-y-2">
                    <form.Field name="phone">
                        {
                            (field) => <Input type="phone" label="Phone" placeholder="e.g. 1023045006" value={field.state.value} onChangeText={field.handleChange}/>
                        }
                    </form.Field>
                    <Text className="text-gray-500 text-sm">You will be required to re-verify your phone number if modified.</Text>
                </View>
                <View className="gap-y-2">
                    <form.Field name="email">
                        {
                            (field) => <Input label="Email" placeholder="Email Address" value={field.state.value} onChangeText={field.handleChange}/>
                        }
                    </form.Field>
                    <Text className="text-gray-500 text-sm">Receive early updates about new features and occasional discounts.</Text>
                </View>
            </View>
            <View className="mb-12">
                <Drawer 
                    href="/(onboarding)/owner/(modal)/language"
                    icon={<IconLanguage width={22} height={22}/>}
                    title="Language"
                    description="Manage your application display preferences."
                />
                <Drawer 
                    href="/(onboarding)/owner/(modal)/notifications"
                    icon={<IconBell width={22} height={22}/>}
                    title="Notifications"
                    description="Select your notification delivery channels."
                />
                <View className="flex-row items-center gap-x-4 border-b border-gray-100 py-5 px-3">
                    <IconTimezone width={22} height={22}/>
                    <View className="flex-1">
                        <Text className="font-medium">Timezone</Text> 
                    </View>
                    <Text className="text-gray-500">{user.preferences.timezone}</Text>
                </View>
                <Drawer 
                    href="/(onboarding)/owner/(modal)/transfer"
                    icon={<IconUserCog width={22} height={22}/>}
                    title="Transfer"
                    description="Change your account to a manager or owner account."
                />
                <SignOutDrawer />
            </View>
        </ScrollView>
    )
}
