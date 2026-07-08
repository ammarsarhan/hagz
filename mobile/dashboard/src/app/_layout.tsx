import "@/../global.css";
import RootNavigator from "@/components/shared/RootNavigator";
import SplashController from "@/components/shared/SplashController";
import { AuthProvider } from "@/context/AuthContext";
import { getQueryClient } from "@/lib/query";
import { QueryClientProvider } from "@tanstack/react-query";

export default function RootLayout() {
  const client = getQueryClient();

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <SplashController />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
