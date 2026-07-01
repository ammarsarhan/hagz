import { User } from '@/lib/types/user';

export default function resolveDefaultRoute(user: User | null): string {
  // User paths with no branching because onboarding will be optional for users.
  if (!user) return "/user/main";
  if (user && user.preferences.role === "USER") return "/user/main";

  // Staff paths with branching to the dashboard onboarding layouts.
  if (user && user.preferences.role === "MANAGER" && user.pitches.length < 1) return "/dashboard/onboarding/manager";
  if (user && user.preferences.role === "OWNER" && user.pitches.length < 1) return "/dashboard/onboarding/owner";
  if (user && user.preferences.role !== "USER" && user.pitches.length >= 1) return "/dashboard/main";

  return "/user/main";
};
