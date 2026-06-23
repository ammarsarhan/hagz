import { ReactNode } from "react";
import { Pressable } from "react-native";

interface ButtonProps {
    children?: ReactNode,
    onPress?: () => void,
    className?: string
}

export default function Button({ children, onPress, className } : ButtonProps) {
    const base = "p-4 rounded-full border flex-row items-center justify-center gap-x-2";

    return (
        <Pressable onPress={onPress} className={`${base} ${className}`}>
            {children}
        </Pressable>
    )
}