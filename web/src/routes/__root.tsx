import { HeadContent, Scripts, createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import appCss from '../styles.css?url'
import { client } from '#/lib/client'
import type { User } from '#/lib/types/user'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  user: User | null
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Hagz',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  context: () => ({
    user: null,
    locations: null,
  }),
  beforeLoad: async () => {
    try {
      const [session, geography] = await Promise.all([
        client.auth.session.$get(),
        client.locations.$get(),
      ]);

      const user = session.ok ? (await session.json()).data.user : null;
      const locations = geography.ok ? (await geography.json()).data.locations : null;

      return { user, locations };
    } catch {
      return { user: null, locations: null };
    }
  },  
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className='text-base'>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
