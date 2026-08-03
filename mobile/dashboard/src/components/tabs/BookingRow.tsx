import { formatPhone } from "@/lib/string";
import { BookingRowData, PricingSnapshot } from "@/lib/types/bookings";
import { addHours, formatDate, isEqual } from "date-fns";
import { Image } from "expo-image";
import { View, Text } from "react-native";

type BookingRowProps = BookingRowData;

const formatPriceType = (priceType: string) => 
    `${priceType[0].toUpperCase()}${priceType.slice(1).toLowerCase()}`;

export default function BookingRow({ hour, bookings }: BookingRowProps) {
    return (
        <View className="gap-y-4">
            <Text>{formatDate(hour, "hh:mm a")} to {formatDate(addHours(hour, 1), "hh:mm a")}</Text>
            {
                bookings.map(item => {
                    const booking = item.booking!;
                    const snapshot = booking.pricingSnapshot as unknown as PricingSnapshot;
                    
                    const slot = snapshot.slots.find(s => 
                        isEqual(new Date(s.startsAt), hour)
                    );

                    const slotIndex = snapshot.slots.findIndex(s => isEqual(new Date(s.startsAt), hour));

                    return (
                        <View key={item.id} className="border border-gray-200 p-6 gap-y-6 rounded-lg w-full">
                            <View className="flex-row items-center justify-between">
                                <View className="gap-y-0.5">
                                    <Text className="font-medium">EGP {slot?.price.toFixed(2)}</Text>
                                    <Text className="text-gray-500 text-[0.95rem]">{slot ? formatPriceType(slot.priceType) : "-"}</Text>
                                </View>
                                <View className="size-9 rounded-full bg-primary/10 items-center justify-center overflow-hidden">
                                    {
                                        booking.initiator.avatarUrl ?
                                        <Image
                                        source={{ uri: booking.initiator.avatarUrl }}
                                        style={{ width: 36, height: 36 }}
                                        contentFit="cover"
                                        /> :
                                        <Text className="text-sm">{booking.initiator.firstName[0].toUpperCase()}</Text>
                                    }
                                </View>
                            </View>
                            <View className="gap-y-1">
                                <Text className="font-medium text-xl">{booking.customer.firstName} {booking.customer.lastName}</Text>
                                <Text className="text-gray-500 text-[0.925rem]">{formatPhone(booking.customer.phone)}</Text>
                                <Text className="text-gray-500 text-sm">{item.ground.name}</Text>
                            </View>
                            <View className="">
                                <Text className="text-sm">
                                    {slotIndex >= 0 ? `(Slot ${slotIndex + 1}/${snapshot.slots.length})` : "-"}
                                </Text>
                            </View>
                        </View>
                    );
                })
            }
        </View>
    );
};
