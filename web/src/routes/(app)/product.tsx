import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/product')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(app)/product"!</div>
}
