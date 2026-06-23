import { useState } from "react";
import { IconX } from '@tabler/icons-react-native';
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Logo from '@/assets/logos/transparent-dark.svg';
import Input from "@/components/general/Input";

export default function AuthModal() {
    const [visible, setVisible] = useState(true);


    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setVisible(false)}
        >
            <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 p-6">
                <Pressable onPress={() => setVisible(false)} className="absolute top-4 right-4">
                    <IconX/>
                </Pressable>

            </SafeAreaView>
        </Modal>
    )
}