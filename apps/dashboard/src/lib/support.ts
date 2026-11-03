import { Linking } from "react-native";

// Hagz support on WhatsApp, from EXPO_PUBLIC_SUPPORT_WHATSAPP (international digits, e.g.
// 201001234567). Until it's set, screens leave the "Contact support" button out.
const number = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "");

export const hasSupport = Boolean(number);

export const contactSupport = () => {
  if (number) void Linking.openURL(`https://wa.me/${number}`);
};
