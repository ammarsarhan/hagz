import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className='px-4 py-10'>
      <div className='flex flex-col gap-y-px'>
        <h1 className='text-lg font-medium'>Profile</h1>
        <span className='text-gray-500 text-sm'>Update your name, phone number, email, address, location, etc.</span>
      </div>
    </main>
  )
}
