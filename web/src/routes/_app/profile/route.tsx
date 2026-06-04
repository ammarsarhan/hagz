import ProfileAside from '#/components/app/ProfileAside'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/profile')({
  component: RouteComponent,
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: '/auth/sign-in' });
    return { user: context.user }
  },
})

function RouteComponent() {
  return (
    <div className='mx-24 h-screen pt-20'>
        <div className='flex gap-x-4 h-full'>
            <ProfileAside/>
            <Outlet />
        </div>
    </div>
  )
}
