import { createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query';
import { client } from '#/lib/client';
import BookingsTable from '#/components/app/BookingsTable';

const options = queryOptions({
  queryKey: ['bookings'],
  queryFn: async () => {
    const res = await client.app.bookings.$get();
    if (!res.ok) throw new Error("Could not fetch booking data.");
    const { data } = await res.json();

    return data;
  }
});

export const Route = createFileRoute('/_app/account/bookings')({
  component: RouteComponent,
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(options),
});

function RouteComponent() {
  const { data } = useQuery(options);

  return (
    <main className='px-4 py-10'>
      <div className='flex flex-col gap-y-px'>
        <h1 className='text-lg font-medium'>Bookings</h1>
        <span className='text-gray-500 text-sm'>View your full bookings history, payments, and track loyalty on pitches.</span>
      </div>
      {
        data ?
        <BookingsTable data={data.bookings}/> :
        <></>
      }
    </main>
  )
}
