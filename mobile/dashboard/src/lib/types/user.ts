import { InferRequestType, InferResponseType } from 'hono/client';
import { client } from '@/lib/client';

type SignUpRequest = InferRequestType<(typeof client.auth)["sign-up"]["$post"]>;
export type SignUpPayload = SignUpRequest["json"];

type SessionResponse = InferResponseType<typeof client.auth.session.$get, 200>;
export type User = SessionResponse['data']['user'];
