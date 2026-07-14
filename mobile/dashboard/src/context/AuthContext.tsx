import { client } from "@/lib/client";
import { clearTokens, getAccessToken, saveTokens } from "@/lib/storage";
import { User } from "@/lib/types/user";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
  saveSession: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const rehydrate = async () => {
      try {
        const token = await getAccessToken();

        if (token) {
          const res = await client.auth.session.$get();

          if (res.ok) {
            const body = await res.json();
            setUser(body.data.user);
          } else {
            await clearTokens();
          }
        }
      } catch (error) {
        console.warn("[AuthContext] Session rehydration failed (network timeout or error):", error);
      } finally {
        setIsLoading(false);
      }
    };

    rehydrate();
  }, []);

  const signOut = async () => {
    await clearTokens();
    queryClient.clear();
    setUser(null);
  };

  const saveSession = async (user: User, accessToken: string, refreshToken: string) => {
    await saveTokens(accessToken, refreshToken);
    setUser(user); 
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, signOut, saveSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>.");
  return ctx;
}

export function useRequiredAuth() {
  const { user, ...context } = useAuth();
  if (!user) throw new Error("Authenticated user is required");
  return { user, ...context };
}
