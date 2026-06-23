import { IconEye, IconEyeOff } from "@tabler/icons-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

interface InputProps {
    label?: string
    value?: string
    onChangeText?: () => void
    placeholder?: string
    className?: string
    type?: "text" | "phone" | "password"
}

export default function Input({ label, value, onChangeText, placeholder, className, type = "text" } : InputProps) {
    const [isVisible, setIsVisible] = useState(type !== "password");
    const base = "w-full rounded-md px-3 h-12 border border-gray-300";

    switch (type) {
        case "phone":
            {
                return (
                    <View className="gap-y-2">
                        {
                            label &&
                            <Text>Phone Number</Text>
                        }
                        <View className="w-full flex-row">
                            <View className="border-l border-y items-center justify-center h-12 px-2.5 rounded-l-md border-gray-300 border-r">
                                <Text>+20</Text>
                            </View>
                            <TextInput
                                keyboardType="number-pad"
                                placeholder={placeholder}
                                value={value}
                                onChangeText={onChangeText}
                                className={`flex-1 border-r border-y  rounded-r-md px-2.5 h-12 border-gray-300 ${className ? className : ""}`}
                            />
                        </View>
                    </View>
                )
            }
        case "password":
            {
                return (
                    <View className="gap-y-2">
                        {
                            label &&
                            <Text>{label}</Text>
                        }
                        <View className="w-full flex-row border border-gray-300 rounded-md">
                            <TextInput
                                secureTextEntry={!isVisible}
                                textContentType="password"
                                autoComplete="password"
                                placeholder={placeholder}
                                value={value}
                                onChangeText={onChangeText}
                                className={`flex-1 rounded-l-md px-2.5 h-12 border-gray-300 ${className ? className : ""}`}
                            />
                            <Pressable onPress={() => setIsVisible(v => !v)} className="items-center justify-center h-12 px-2.5 rounded-r-md">
                                {
                                    isVisible ?
                                    <IconEyeOff size={20}/> :
                                    <IconEye size={20}/>
                                }
                            </Pressable>
                        </View>
                    </View>
                )
            }
        case "text":
            {
                return (
                    <View className="gap-y-2">
                        {
                            label &&
                            <Text>{label}</Text>
                        }
                        <TextInput
                            placeholder={placeholder}
                            value={value}
                            onChangeText={onChangeText}
                            className={`${base} ${className ? className : ""}`}
                        />
                    </View>
                )
            }
    }
}