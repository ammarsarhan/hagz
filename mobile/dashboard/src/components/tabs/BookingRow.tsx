import cn from "@/lib/cn";
import { formatCurrency, formatPhone, parseEnum } from "@/lib/string";
import { BookingRowData, PricingSnapshot } from "@/lib/types/bookings";
import { addHours, formatDate, isEqual } from "date-fns";
import { Image } from "expo-image";
import { useState } from "react";
import { View, Text, ScrollView, LayoutChangeEvent } from "react-native";

type BookingRowProps = BookingRowData;

export function BookingCard({
    item,
    hour,
    groupedRange,
}: {
    item: BookingRowData["bookings"][number];
    hour: Date;
    groupedRange?: { from: Date; to: Date };
}) {
    const booking = item.booking!;
    const snapshot = booking.pricingSnapshot as unknown as PricingSnapshot;

    const slot = snapshot.slots.find(s =>
        isEqual(new Date(s.startsAt), hour)
    );

    const slotIndex = snapshot.slots.findIndex(s => isEqual(new Date(s.startsAt), hour));

    const bottomLeft = groupedRange
        ? `${formatDate(groupedRange.from, "hh:mm a")} to ${formatDate(groupedRange.to, "hh:mm a")}`
        : parseEnum(booking.status);

    const bottomRight = groupedRange
        ? parseEnum(booking.status)
        : (slotIndex >= 0 ? `(Slot ${slotIndex + 1}/${snapshot.slots.length})` : "-");

    return (
        <View className={cn("border border-gray-200 p-6 gap-y-6 rounded-lg w-full")}>
            <View className="flex-row items-center justify-between">
                <View className="gap-y-0.5">
                    <Text className="font-medium">{slot ? formatCurrency(slot.price) : "-"}</Text>
                    <Text className="text-gray-500 text-[0.95rem]">{slot ? parseEnum(slot.priceType) : "-"}</Text>
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
            <View className="gap-y-2 mb-2">
                <Text className="font-medium text-lg">{booking.customer.firstName} {booking.customer.lastName}</Text>
                <Text className="text-gray-500 -mt-0.5">{formatPhone(booking.customer.phone)}</Text>
                <Text className="text-gray-500">{item.ground.name}</Text>
            </View>
            <View className="flex-row items-center justify-between">
                <Text className="text-[0.95rem]">{bottomLeft}</Text>
                <Text className="text-[0.95rem] text-gray-500">{bottomRight}</Text>
            </View>
        </View>
    );
};

export default function BookingRow({ hour, bookings }: BookingRowProps) {
    const hourDate = typeof hour === "string" ? new Date(hour) : hour;

    const [containerWidth, setContainerWidth] = useState(0);

    const handleLayout = (e: LayoutChangeEvent) => {
        setContainerWidth(e.nativeEvent.layout.width);
    };

    const cardWidth = containerWidth - 24 * 2;
    const isSingle = bookings.length === 1;

    return (
        <View className="gap-y-4">
            <View className="px-6">
                <Text>{formatDate(hourDate, "hh:mm a")} to {formatDate(addHours(hourDate, 1), "hh:mm a")}</Text>
            </View>
            {
                isSingle ?
                <View className="px-6">
                    <BookingCard item={bookings[0]} hour={hourDate} />
                </View> :
                <View onLayout={handleLayout}>
                    {
                        containerWidth > 0 &&
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            decelerationRate="fast"
                            snapToInterval={cardWidth + 16}
                            snapToAlignment="start"
                            contentContainerClassName="px-6"
                            contentContainerStyle={{ gap: 16 }}
                        >
                            {
                                bookings.map(item => (
                                    <View key={item.id} style={{ width: cardWidth }}>
                                        <BookingCard item={item} hour={hourDate} />
                                    </View>
                                ))
                            }
                        </ScrollView>
                    }
                </View>
            }
        </View>
    );
};
