import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account/sessions')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className='px-4 py-10'>
      <div className='flex flex-col gap-y-px'>
        <h1 className='text-lg font-medium'>Signed-in Devices</h1>
        <span className='text-gray-500 text-sm'>Keep track of other actively logged-in devices on your account and manage access.</span>
      </div>
    </main>
  )
}
