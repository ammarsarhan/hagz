import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/pitches/$pitchId/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/dashboard/pitches/:pitchId/"!</div>
}
