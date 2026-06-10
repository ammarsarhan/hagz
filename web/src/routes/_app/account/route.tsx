import AccountAside from '#/components/app/AccountAside'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account')({
  component: RouteComponent,
  beforeLoad: ({ context }) => {
    // Todo: Handle this error better.
    if (!context.locations) throw redirect({ to: "/auth/sign-in" });
    if (!context.user) throw redirect({ to: '/auth/sign-in' });
    return { user: context.user, locations: context.locations }
  },
})

function RouteComponent() {
  return (
    <div className='mx-24 h-screen pt-20'>
        <div className='flex gap-x-4 h-full'>
            <AccountAside/>
            <main className='flex-1 min-h-[calc(100vh-5rem)]'>
              <Outlet />
            </main>
        </div>
    </div>
  )
}
