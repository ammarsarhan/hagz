import ProfileAside from '#/components/app/ProfileAside'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/profile')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className='mx-24 h-screen pt-20'>
        <div className='flex gap-x-4 h-full'>
            <ProfileAside />
            <Outlet />
        </div>
    </div>
  )
}
