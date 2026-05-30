import { createFileRoute, Outlet } from '@tanstack/react-router'
import Navigation from '#/components/app/Navigation';

export const Route = createFileRoute('/_app')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = Route.useRouteContext();

  return (
    <>
        <Navigation user={user} />
        <Outlet />
    </>
  )
}
