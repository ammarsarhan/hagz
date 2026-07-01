import { useAuth } from '@/context/AuthContext';
import resolveDefaultRoute from '@/lib/routing';
import { Redirect } from 'expo-router';

export default function Index() {
  const { user } = useAuth();
  const defaultRoute = resolveDefaultRoute(user);

  return <Redirect href={defaultRoute}/>  
}
