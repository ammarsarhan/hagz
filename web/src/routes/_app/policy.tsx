import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/policy')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/policy"!</div>
}
