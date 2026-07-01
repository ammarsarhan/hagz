import { User } from '@/lib/types/user';

export default function resolveDefaultRoute(user: User | null): string {
  // User paths with no branching because onboarding will be optional for users.
  if (!user) return '/user/main';

  const { role } = user.preferences;

  // Staff paths with branching to the dashboard onboarding layouts.
  if (role === 'USER') return '/user/main';

  if (role === 'MANAGER' && user.pitches.length < 1) return '/dashboard/onboarding/manager';
  if (role === 'OWNER' && user.pitches.length < 1) return '/dashboard/onboarding/owner';

  // any remaining case is staff (MANAGER/OWNER) with pitches.length >= 1
  return '/dashboard/main';
};
