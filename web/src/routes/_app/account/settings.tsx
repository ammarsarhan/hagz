import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className='px-4 py-10'>
      <div className='flex flex-col gap-y-px'>
        <h1 className='text-lg font-medium'>Settings</h1>
        <span className='text-gray-500 text-sm'>Update your default search options, language, and notification preferences.</span>
      </div>
    </main>
  )
}
