import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/pitches/$pitchId/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/pitches/$pitchId/"!</div>
}
