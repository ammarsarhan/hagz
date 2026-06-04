import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account/notifications')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className='px-4 py-10'>
      <div className='flex flex-col gap-y-px'>
        <h1 className='text-lg font-medium'>Notifications</h1>
        <span className='text-gray-500 text-sm'>View your latest notifications to keep track of your bookings.</span>
      </div>
    </main>
  )
}
