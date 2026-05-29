import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/product')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/product"!</div>
}
