import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pitches/search')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/pitches/search"!</div>
}
