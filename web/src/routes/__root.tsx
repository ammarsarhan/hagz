import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'
import { client } from '#/lib/client'

export const Route = createRootRoute({
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
    locations: null
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
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
