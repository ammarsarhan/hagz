import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/bookings/$bookingId/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/bookings/$bookingId/"!</div>
}
