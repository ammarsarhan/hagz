import "@/../global.css";
import AppLayout from "@/components/shared/AppLayout";
import { createErrorBoundary } from "@/components/shared/ErrorView";
import { AuthProvider } from "@/context/AuthContext";
import { getQueryClient } from "@/lib/query";
import { QueryClientProvider } from "@tanstack/react-query";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const client = getQueryClient();

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <KeyboardProvider>
          <ActionSheetProvider>
            <GestureHandlerRootView className="flex-1">
              <AppLayout />
            </GestureHandlerRootView>
          </ActionSheetProvider>
        </KeyboardProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export const ErrorBoundary = createErrorBoundary();