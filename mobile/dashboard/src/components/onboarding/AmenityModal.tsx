import { useEffect, useState } from "react";
import { I18nManager, Modal, Platform, Pressable, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import * as z from "zod";
import Input from "@/components/shared/Input";
import Button from "@/components/shared/Button";
import { IconTrash, IconX } from "@tabler/icons-react-native";
import { Amenity, AmenityName, getAmenityMeta } from "@/lib/types/amenity";
import trim from "@/lib/string";
import cn from "@/lib/cn";

type Unit = NonNullable<Amenity["unit"]>;

type AmenityModalProps = {
    visible: boolean;
    name: AmenityName | null;
    initialValue?: Amenity;
    onClose: () => void;
    onSave: (amenity: Amenity) => void;
    onRemove?: () => void;
};

const schema = z
    .object({
        name: z.string(),
        isPaid: z.boolean(),
        description: trim("Amenity description must be valid text.")
            .pipe(
                z
                    .string()
                    .refine(
                        val => {
                            if (!val) return true;
                            const words = val.split(/\s+/).filter(Boolean);
                            return words.length >= 3 && words.length <= 75;
                        },
                        "Amenity description must be between 3 and 75 words."
                    )
            ),
        price: z.string().optional(),
        unit: z.enum(["PER_HOUR", "PER_BOOKING"]).optional(),
    })
    .superRefine((data, ctx) => {
        if (data.isPaid) {
            const parsedPrice = Number(data.price);

            if (!data.price || !data.price.trim() || Number.isNaN(parsedPrice)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["price"],
                    message: "Amenity price is required when paid.",
                });
            } else if (!Number.isInteger(parsedPrice) || parsedPrice < 5 || parsedPrice > 500) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["price"],
                    message: "Price must be an integer between 5 and 500 EGP.",
                });
            }

            if (!data.unit) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["unit"],
                    message: "Pricing unit is required when paid.",
                });
            }
        }
    });

export default function AmenityModal({
    visible,
    name,
    initialValue,
    onClose,
    onSave,
    onRemove,
}: AmenityModalProps) {
    const [isPaid, setIsPaid] = useState(false);
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [unit, setUnit] = useState<Unit>("PER_BOOKING");

    const isEdit = !!initialValue;
    const isRTL = I18nManager.isRTL;

    useEffect(() => {
        if (!visible) return;
        setIsPaid(initialValue?.price !== undefined);
        setDescription(initialValue?.description ?? "");
        setPrice(initialValue?.price !== undefined ? String(initialValue.price) : "");
        setUnit(initialValue?.unit ?? "PER_BOOKING");
    }, [visible, initialValue]);

    if (!name) return null;

    const { icon: Icon, label } = getAmenityMeta(name);

    const isValid = schema.safeParse({
        name,
        isPaid,
        description,
        price,
        unit,
    }).success;

    const handleSave = () => {
        if (!isValid) return;

        const amenity: Amenity = {
            name,
            description: description.trim() ? description.trim() : undefined,
            ...(isPaid
                ? {
                    price: price.trim() ? Number(price) : undefined,
                    unit: price.trim() ? unit : undefined,
                }
                : {}),
        };

        onSave(amenity);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
            allowSwipeDismissal
        >
            <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
                <KeyboardAwareScrollView
                    className="flex-1"
                    contentContainerStyle={{ 
                        flexGrow: 1, 
                        paddingHorizontal: 24, 
                        paddingTop: 24, 
                        paddingBottom: 24 
                    }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bottomOffset={32}
                >
                    <View className="flex-row items-center justify-between mb-3">
                        <Pressable
                            className="size-11 items-center justify-center rounded-full bg-gray-100"
                            onPress={onClose}
                        >
                            <IconX size={18} />
                        </Pressable>
                        {
                            isEdit && onRemove && (
                                <Pressable onPress={() => {
                                    onRemove();
                                    onClose();
                                }} className="p-2 border rounded-full border-gray-200">
                                    <IconTrash size={20} color="#6B7280" />
                                </Pressable>
                            )
                        }
                    </View>
                    <View className="gap-y-2 py-2 mb-6">
                        <Text className="text-3xl font-semibold">{isEdit ? "Edit" : "Add"} {label.en}</Text>
                        <Text className="text-gray-500">
                            {isEdit ? "Modify your amenity details and save your changes." : "Add an amenity with the suitable pricing for your venue."}
                        </Text>
                    </View>
                    <View className="flex-1 gap-y-12">
                        <View className="gap-y-2">
                            <Text className="font-medium">Amenity</Text>
                            <View className="w-full flex-row">
                                <View
                                    className={cn(
                                        'flex-1 flex-row items-center gap-x-2 rounded-lg border border-gray-100 px-3 py-3',
                                        isRTL ? 'text-right' : 'text-left'
                                    )}
                                >
                                    <Icon width={20} height={20} color="#6B7280"/>   
                                    <Text className="font-medium">{label.en}</Text>
                                </View>
                            </View>
                        </View>
                        <View className="flex-row items-center justify-between gap-x-4">
                            <View className="flex-1 gap-y-1">
                                <Text className="font-medium">Add-on?</Text>
                                <Text className="text-gray-500 text-sm">Can this amenity be rented/paid for at your venue?</Text>
                            </View>
                            <View>
                                <Switch
                                    value={isPaid}
                                    onValueChange={() => setIsPaid(prev => !prev)}
                                    className="scale-90"
                                    trackColor={{ false: "#D1D5DB", true: "#1C04EA" }}
                                    thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
                                    ios_backgroundColor="#D1D5DB"
                                />
                            </View>
                        </View>
                        {
                            isPaid &&
                            <>
                                <Input  
                                    label="Description (Optional)" 
                                    placeholder="Must be between 3 and 75 words." 
                                    multiline 
                                    value={description} 
                                    onChangeText={setDescription}
                                />
                                <Input 
                                    label="Price" 
                                    type="price"
                                    value={price}
                                    onChangeText={setPrice}
                                    placeholder="0.00"
                                />
                                <View className="gap-y-3">  
                                    <Text className="font-medium">Pricing Unit</Text>
                                    <View className="flex-row gap-x-3">
                                        <Pressable 
                                            onPress={() => setUnit("PER_HOUR")}
                                            className={cn(
                                                "flex-1 rounded-lg border px-4 py-3 items-center justify-center",
                                                unit === "PER_HOUR"
                                                    ? "bg-white border-primary"
                                                    : "bg-white border-gray-200"
                                            )}
                                        >
                                            <Text 
                                                className={cn(
                                                    "font-medium",
                                                    unit === "PER_HOUR" ? "text-primary" : "text-gray-500"
                                                )}
                                            >
                                                Per hour
                                            </Text>
                                        </Pressable>
                                        <Pressable 
                                            onPress={() => setUnit("PER_BOOKING")}
                                            className={cn(
                                                "flex-1 rounded-lg border px-4 py-3 items-center justify-center",
                                                unit === "PER_BOOKING"
                                                    ? "bg-white border-primary"
                                                    : "bg-white border-gray-200"
                                            )}
                                        >
                                            <Text 
                                                className={cn(
                                                    "font-medium",
                                                    unit === "PER_BOOKING" ? "text-primary" : "text-gray-500"
                                                )}
                                            >
                                                Per booking
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </>
                        }
                    </View>
                </KeyboardAwareScrollView>
                <View className="px-6 pb-8 pt-4">
                    <Button 
                        className="bg-primary border-primary" 
                        disabled={!isValid} 
                        onPress={handleSave}
                    >
                        <Text className="font-medium text-white">{isEdit ? "Update amenity" : "Save amenity"}</Text>
                    </Button>
                </View>
            </SafeAreaView>
        </Modal>
    );
}