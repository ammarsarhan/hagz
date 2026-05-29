import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/contact')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/contact"!</div>
}
