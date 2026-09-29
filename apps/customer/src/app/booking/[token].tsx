import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function SharedBooking() {
  const { token } = useLocalSearchParams<{ token: string }>();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Booking {token}</Text>
    </View>
  );
}
