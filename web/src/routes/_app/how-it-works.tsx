import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/how-it-works')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/how-it-works"!</div>
}
