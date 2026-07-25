import { Href, Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Avatar from "@/components/shared/Avatar";
import Button from "@/components/shared/Button";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { IconBallFootball, IconChevronRight, IconLayoutDashboard, IconPhotoAlt, IconTextCaption } from "@tabler/icons-react-native";
import useDraftQuery from "@/lib/hooks/useDraftQuery";
import cn from "@/lib/cn";
import { ReactNode } from "react";
import { usePitchDraftForm } from "@/context/forms/PitchDraftContext";
import { isDetailsComplete } from "@/lib/validation/onboarding";

interface StepProps {
    icon: ReactNode;
    title: string;
    description: string;
    isActive: boolean;
    isComplete: boolean;
    href: Href
}

const Step = ({ icon, title, description, href, isActive, isComplete } : StepProps) => {
    if (isComplete) return null;

    return (
        <Link asChild href={href} disabled={!isActive}>
            <Pressable className={cn("p-5 flex-row items-center gap-x-4 rounded-lg", isActive ? "bg-white border border-gray-100 " : "bg-gray-50")}>
                {icon}
                <View className="flex-1">
                    <Text className={cn(isActive ? "font-semibold" : "font-medium text-gray-400")}>{title}</Text>
                    <Text className={cn("text-sm", isActive ? "text-gray-500" : "text-gray-400")}>{description}</Text>
                </View>
                {
                    isActive &&
                    <View>
                        <IconChevronRight width={20} height={20} color="#9CA3AF"/>
                    </View>
                }
            </Pressable>
        </Link>
    )
};

export default function Index() {
    const { draft, query } = useDraftQuery();
    const { state } = usePitchDraftForm();

    const pitch = query.data;

    const completed = {
        details: !!draft && isDetailsComplete(state),
        media: state.media.filter(m => m.state === "UPLOADED").length >= 3,
        amenities: state.amenities.length > 0,
        grounds: !!pitch && pitch.status === "SUBMITTED",
    };

    const active = {
        details: !completed.details,
        media: completed.details && !completed.media,
        amenities: completed.details && completed.media && !completed.amenities,
        grounds: completed.details && completed.media && completed.amenities && !completed.grounds,
    };

    const handleCopyRef = async () => {
        if (draft) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await Clipboard.setStringAsync(`#${draft!.pitchId}`);
        };
    };

    return (
        <Animated.View entering={FadeIn.duration(400).delay(100)} className="flex-1">
            <SafeAreaView className="p-6 flex-1 gap-y-10">
                <View className="gap-y-3">
                    <View className="mb-2">
                        <Pressable onPress={() => router.push("/(onboarding)/owner/(modal)")}>
                            <Avatar />
                        </Pressable>
                    </View>
                    {
                        draft &&
                        <View className="flex-row items-center gap-x-1">
                            <Text className="text-sm text-gray-500">Ref:</Text> 
                            <Pressable onPress={handleCopyRef}>
                                <Text selectable className="text-sm text-gray-500">{`#${draft.pitchId}`}</Text>
                            </Pressable>
                        </View>
                    }
                    <Text className="text-4xl font-semibold">
                        {
                            draft ?
                            "Continue setting up your pitch" : 
                            "Create your first pitch"
                        }
                    </Text> 
                    <Text className="text-gray-500">
                        {
                            draft ?
                            "Your progress has been saved. Let's get you up and running quickly!" :
                            "You do not have any pitches yet. Let's get started by creating your first pitch."
                        }
                    </Text> 
                </View>
                <View className="gap-y-4 flex-1 w-full">
                    <Step 
                        icon={<IconTextCaption color={"#000"} width={24} height={24}/>}
                        title="Details"
                        description="Add basic information about your pitch."
                        isActive={active.details}
                        isComplete={completed.details}
                        href="/(onboarding)/owner/(steps)/details"
                    />
                    <Step 
                        icon={<IconPhotoAlt color={"#9CA3AF"} width={24} height={24}/>}
                        title="Media & Images"
                        description="Take pictures of your pitch, grounds, and amenities to show users."
                        isActive={active.media}
                        isComplete={completed.media}
                        href="/(onboarding)/owner/(steps)/media"
                    />
                    <Step 
                        icon={<IconBallFootball color={"#9CA3AF"} width={24} height={24}/>}
                        title="Amenities"
                        description="Select amenities and how your venue prices them."
                        isActive={active.amenities}
                        isComplete={completed.amenities}
                        href="/(onboarding)/owner/(steps)/amenities"
                    />
                    <Step 
                        icon={<IconLayoutDashboard color={"#9CA3AF"} width={24} height={24}/>}
                        title="Grounds"
                        description="Create grounds and specify their settings & schedule."
                        isActive={active.grounds}
                        isComplete={completed.grounds}
                        href="/(onboarding)/owner/(steps)/grounds"
                    />
                </View>
                <Link asChild href="/(onboarding)/owner/(steps)/details">
                    <Button className="bg-primary border-primary">
                        <Text className="text-white font-medium">
                            {
                                draft ? "Go to details" : "Get Started"
                            }
                        </Text>
                    </Button>
                </Link>
            </SafeAreaView>
        </Animated.View>
    )
}