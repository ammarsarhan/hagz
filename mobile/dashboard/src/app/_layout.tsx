import { Stack } from "expo-router";
import "@/../global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query";
import { AuthProvider } from "@/context/AuthContext";
import SplashController from "@/components/shared/SplashController";

export default function RootLayout() {
  const client = getQueryClient();

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <SplashController/>
        <Stack />
      </AuthProvider>
    </QueryClientProvider>
  );
}
