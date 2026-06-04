import AccountAside from '#/components/app/AccountAside'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account')({
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
            <AccountAside/>
            <Outlet />
        </div>
    </div>
  )
}
