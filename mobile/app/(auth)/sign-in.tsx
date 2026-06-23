import Input from '@/components/shared/Input';
import { IconChevronLeft } from '@tabler/icons-react-native';
import { Link } from 'expo-router';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import Button from '@/components/shared/Button';

export default function SignIn() {
    return (
        <SafeAreaView className="flex-1">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View className='flex-1'>
                        <Link href="/" asChild>
                            <Pressable className="flex-row items-center gap-x-[1px]">
                                <IconChevronLeft />
                                <Text>Back</Text>
                            </Pressable>
                        </Link>
                        <View className='flex-1 items-center justify-center gap-y-8 p-6'>
                            <View className='flex-col gap-y-3'>
                                <Text className='text-4xl font-semibold mt-2'>Sign In to Hagz</Text>
                                <Text className='text-gray-500'>Log back in to your account to explore and book venues.</Text>
                            </View>
                            <View className='w-full gap-y-4'>
                                <Input placeholder='Phone' type='phone' label='Phone'/>
                                <Input placeholder='Password' type='password' label='Password'/>
                                <View>
                                    <Link href="/" className='text-primary-foreground'>Forgot password?</Link>
                                </View>
                            </View>
                            <Button className='bg-primary border-primary w-1/2'>
                                <Text className='font-medium'>Sign In</Text>
                            </Button>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
            <View className='flex-row flex-wrap gap-x-1 text-sm w-full items-center justify-center pb-4'>
                <Text className='text-gray-500 text-[0.95rem]'>Don&apos;t have an account yet?</Text>
                <Link href="/sign-up" className='text-primary-foreground text-[0.95rem]'>Create one</Link>
            </View>
        </SafeAreaView>
    )
}