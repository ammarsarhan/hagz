import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/profile/sessions')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/profile/sessions"!</div>
}
