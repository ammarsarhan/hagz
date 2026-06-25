import { createFileRoute, Outlet } from '@tanstack/react-router'
import Navigation from '#/components/shared/Navigation'

export const Route = createFileRoute('/(app)')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <>
        <Navigation />
        <main className='mt-18'>
          <Outlet /> 
        </main>
    </>
  )
}
