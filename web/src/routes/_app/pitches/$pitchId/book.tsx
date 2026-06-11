import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/pitches/$pitchId/book')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/pitches/$pitchId/book"!</div>
}
