import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/profile/notifications')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/profile/notifications"!</div>
}
