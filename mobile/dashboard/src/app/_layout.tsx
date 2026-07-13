import "@/../global.css";
import AppLayout from "@/components/shared/AppLayout";
import { AuthProvider } from "@/context/AuthContext";
import { getQueryClient } from "@/lib/query";
import { QueryClientProvider } from "@tanstack/react-query";

export default function RootLayout() {
  const client = getQueryClient();

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </QueryClientProvider>
  );
}