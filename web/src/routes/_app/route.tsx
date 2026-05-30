import { createFileRoute, Outlet } from '@tanstack/react-router'
import Navigation from '#/components/app/Navigation';

export const Route = createFileRoute('/_app')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <>
        <Navigation />
        <Outlet />
    </>
  )
}
