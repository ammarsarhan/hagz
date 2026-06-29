import { getDisplayGroundSport } from "@/i18next/maps/enums";
import { Sport, sportIcons } from "@/lib/types/ground";
import { View, Text } from "react-native";

export default function SportCard({ sport } : { sport: Sport }) {
    const IconComponent = sportIcons[sport];
    
    return (
        <View className="rounded-lg bg-gray-100 h-40 p-4 items-center justify-center gap-y-2" style={{ width: "31%" }}>
            <IconComponent size={40} strokeWidth={1.5} />
            <Text className="font-medium text-lg">{getDisplayGroundSport(sport)}</Text>
        </View>
    )
}