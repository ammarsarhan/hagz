import { InferRequestType } from 'hono/client';
import { client } from '@/lib/client';

type PitchDraftRequest = InferRequestType<(typeof client.dashboard.pitches.$post)>;
export type PitchDraftPayload = PitchDraftRequest["json"];
