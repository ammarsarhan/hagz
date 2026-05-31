import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/profile/history')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/profile/history"!</div>
}
