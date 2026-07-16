import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import { useAuth } from "@/context/AuthContext";
import { client } from "@/lib/client";
import { IconChevronLeft } from "@tabler/icons-react-native";
import { useForm } from "@tanstack/react-form";
import { router } from "expo-router";
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback, View, Text, StatusBar, Pressable, Alert } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { parseClientError, getErrorMessage } from "@/lib/error";

export default function SignIn() {
  const { setUser, saveSession } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    defaultValues: {
      phone: "",
      password: ""
    },
    onSubmit: async ({ value }) => {
      setLoading(true);
      
      try {
          const phone = `+20${value.phone}`;
          const res = await client.auth["sign-in"].$post({ json: {...value, phone } });
  
          if (res.ok) {
              const { data } = await res.json();
              const { user, accessToken, refreshToken } = data;
  
              if (accessToken && refreshToken) {
                  saveSession(user, accessToken, refreshToken);
              } else {
                  // We shouldn't hit this because we're sending the request with the proper X-Client headers.
                  // In case we do, just store the user.
                  setUser(user);
              };

              // Let the Stack.protected pattern we have instilled across the application handle the situation.
              return;
          };
  
          const error = await parseClientError(res);
          let message = error.message;
  
          if (error.fields?.length) {
              message = error.fields.map(f => f.message).join("\n");
          }
  
          message = getErrorMessage(error);
          Alert.alert("Sign in failed", message);
      } catch (err) {
          console.log(err);
          Alert.alert("Connection error", "Couldn't connect. Check your connection and try again.");
      } finally {
          setLoading(false);
      }
    }
  });

  const handleBack = () => {
    router.back();
    Keyboard.dismiss();
  };  

  return (
    <>
      <StatusBar barStyle={"dark-content"}/> 
      <Animated.View entering={FadeIn.duration(400).delay(100)} className={"flex-1"}>
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View className="flex-1">
              <SafeAreaView className="px-6 py-2">
                <Pressable className="size-11 items-center justify-center rounded-full bg-gray-100" onPress={handleBack}>
                  <IconChevronLeft size={18}/>
                </Pressable>
              </SafeAreaView>
              <View className="flex-1 gap-y-8 px-6">
                  <View className="gap-y-3">  
                    <Text className="text-4xl font-semibold">Sign In to Hagz</Text>
                    <Text className="text-gray-500">Log in back into your account to access your bookings and manage your venues.</Text>
                  </View>
                  <View className="gap-y-3">
                    <form.Field name="phone">  
                      {
                        (field) => <Input type="phone" placeholder="Phone Number" label="Phone" value={field.state.value} onChangeText={field.handleChange}/>
                      }
                    </form.Field>
                    <form.Field name="password">
                      {
                        (field) => <Input type="password" textContentType="password" placeholder="Password" label="Password" value={field.state.value} onChangeText={field.handleChange}/>
                      }
                    </form.Field>
                  </View>
                  <Button className="bg-primary" loading={loading} onPress={form.handleSubmit}>
                      <Text className="text-white font-medium">Sign In</Text>
                  </Button>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
}
