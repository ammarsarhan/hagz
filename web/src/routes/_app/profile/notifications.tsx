import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/profile/notifications')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/profile/notifications"!</div>
}
