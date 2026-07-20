import { InferResponseType } from 'hono/client';
import { client } from '@/lib/client';

type LocationsResponse = InferResponseType<typeof client.locations.$get, 200>;

export type Governorate = LocationsResponse['data']['locations'][number];
export type Area = Governorate['areas'][number];
