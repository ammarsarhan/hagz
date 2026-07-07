import { client } from "@/lib/client";
import { clearTokens, getAccessToken } from "@/lib/storage";
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

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>.");
  return ctx;
}
