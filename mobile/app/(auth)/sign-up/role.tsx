import Button from "@/components/shared/Button";
import { useSignUpForm } from "@/context/forms/SignUpContext";
import { IconBallBasketball, IconSoccerField, IconUser } from "@tabler/icons-react-native";
import { Link } from "expo-router";
import { StatusBar, View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Role() {
    const { data, setData } = useSignUpForm();
    const isDisabled = data.role === null;

    return (
        <>
            <StatusBar barStyle='dark-content'/>
            <View className="flex-1 bg-white overflow-hidden">
                <View className="absolute -left-48 -top-8 opacity-5 -z-10">
                    <IconBallBasketball width={400} height={400} strokeWidth={1.5}/>
                </View>
                <SafeAreaView className="flex-1 items-center justify-center p-6">
                    <View className="gap-y-10 w-full">
                        <View className="gap-y-3">
                            <Text className="text-4xl font-semibold text-center">Let&apos;s get you up & running!</Text>
                            <Text className="text-gray-500 text-center">What will you use Hagz for? You can always change this later in your account settings.</Text>
                        </View>
                        <View className="gap-y-6">
                            <Pressable className={`flex-row items-center gap-x-5 p-5 rounded-xl ${data.role === "USER" ? "bg-[#F5FFC2]" : "bg-gray-100"}`} onPress={() => setData({ ...data, role: "USER" })}>
                                <IconUser height={30} width={30} color={data.role === "USER" ? "#1F4F33" : "#000000"}/>
                                <View className="flex-1">
                                    <Text className={`font-semibold text-[1.2rem] ${data.role === "USER" ? "text-primary-foreground" : "text-black"}`}>User</Text>
                                    <Text className={`text-gray-500 text-sm ${data.role === "USER" ? "text-primary-foreground" : "text-black"}`}>I want to discover pitches and book for as cheap as possible.</Text>
                                </View>
                                <View className={`size-6 border ${data.role === "USER" ? "border-primary-foreground" : "border-gray-300"} rounded-full bg-white items-center justify-center`}>
                                    <View className={`${data.role === "USER" ? "bg-primary-foreground" : "bg-white"} size-3 rounded-full items-center justify-center`}></View>
                                </View>
                            </Pressable>
                            <Pressable className={`flex-row items-center gap-x-5 p-5 rounded-xl ${data.role === "STAFF" ? "bg-[#F5FFC2]" : "bg-gray-100"}`} onPress={() => setData({ ...data, role: "STAFF" })}>
                                <IconSoccerField height={30} width={30} color={data.role === "STAFF" ? "#1F4F33" : "#000000"}/>
                                <View className="flex-1">
                                    <Text className={`font-semibold text-[1.2rem] ${data.role === "STAFF" ? "text-primary-foreground" : "text-black"}`}>Owner</Text>
                                    <Text className={`text-gray-500 text-sm ${data.role === "STAFF" ? "text-primary-foreground" : "text-black"}`}>I want to manage pitches & maximize my booking occupancy.</Text>
                                </View>
                                <View className={`size-6 border ${data.role === "STAFF" ? "border-primary-foreground" : "border-gray-300"} rounded-full bg-white items-center justify-center`}>
                                    <View className={`${data.role === "STAFF" ? "bg-primary-foreground" : "bg-white"} size-3 rounded-full items-center justify-center`}></View>
                                </View>
                            </Pressable>
                        </View>
                        <Link asChild href={"/sign-up/name"} disabled={isDisabled}>
                            <Button className={isDisabled ? "border-primary/40 bg-primary/40" : "border-primary bg-primary"}>
                                <Text className="font-semibold">Next</Text>
                            </Button>
                        </Link>
                    </View>
                </SafeAreaView>
            </View>
        </>
    )
}