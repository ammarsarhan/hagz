import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account/bookings')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className='px-4 py-10'>
      <div className='flex flex-col gap-y-px'>
        <h1 className='text-lg font-medium'>Bookings</h1>
        <span className='text-gray-500 text-sm'>View your full bookings history, payments, and track loyalty points on pitches.</span>
      </div>
    </main>
  )
}
