import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account/referrals')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className='px-4 py-10'>
      <div className='flex flex-col gap-y-px'>
        <h1 className='text-lg font-medium'>Referrals</h1>
        <span className='text-gray-500 text-sm'>Refer friends and recieve a discount on your next booking.</span>
      </div>
    </main>
  )
}
