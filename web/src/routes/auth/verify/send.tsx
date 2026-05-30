import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/verify/send')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/auth/verify/send"!</div>
}
