import { Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback, View } from "react-native";

export default function SignIn() {
  return (
    <KeyboardAvoidingView className="flex-1" behavior="padding">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View className="flex-1">
          
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
