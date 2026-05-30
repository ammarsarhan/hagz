import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/product/users')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/product/users"!</div>
}
