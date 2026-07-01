import { useAuth } from "@/context/AuthContext";
import resolveDefaultRoute from "@/lib/routing";
import { Redirect } from "expo-router";

export default function Index() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return <Redirect href={resolveDefaultRoute(user)} />;
}