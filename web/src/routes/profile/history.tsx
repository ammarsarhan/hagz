import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/profile/history')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/profile/history"!</div>
}
