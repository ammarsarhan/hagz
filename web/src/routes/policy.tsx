import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/policy')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/policy"!</div>
}
