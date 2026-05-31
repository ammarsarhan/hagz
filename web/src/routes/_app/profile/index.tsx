import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/profile/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className='px-4 py-10'>
      Lorem ipsum dolor, sit amet consectetur adipisicing elit. Architecto velit temporibus vel qui perspiciatis adipisci beatae molestias? Est dolore aliquid necessitatibus animi dolor molestias, vero consectetur, repellat ipsam veritatis odit!
    </main>
  )
}
