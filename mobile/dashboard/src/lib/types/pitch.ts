import { InferRequestType, InferResponseType } from 'hono/client';
import { client } from '@/lib/client';
import { Media } from '@/lib/types/media';
import { Amenity } from '@/lib/types/amenity';
import { GroundDraftType } from '@/lib/types/ground';

export type PitchesRequest = typeof client.dashboard.pitches;
export type PitchesResponse = PitchesRequest['$get'];

export type PitchRequest = (typeof client.dashboard.pitches)[':pitchId'];
export type PitchResponse = InferResponseType<PitchRequest['$get']>;

type CreatePitchRequest = InferRequestType<(typeof client.dashboard.pitches.$post)>;
export type CreatePitchPayload = CreatePitchRequest["json"];

type PitchMediaPresignRequest = InferRequestType<(PitchRequest['media']['presign']['$post'])>;
export type PitchMediaPresignPayload = PitchMediaPresignRequest["json"];
type PitchMediaConfirmRequest = InferRequestType<(PitchRequest['media'][':mediaId']['confirm']['$post'])>;
export type PitchMediaConfirmPayload = PitchMediaConfirmRequest["param"];

export type PitchMediaResponse = InferResponseType<(PitchRequest['media']['$get'])>;

type PitchAmenityRequest = InferRequestType<(PitchRequest['amenities']['$post'])>;
export type PitchAmenityPayload = PitchAmenityRequest["json"];
export type PitchAmenityResponse = InferResponseType<(PitchRequest['amenities']['$get'])>;

type GroundRequest = PitchRequest['grounds'][':groundId'];
export type GroundResponse = InferResponseType<GroundRequest['$get']>;

type CreateGroundRequest = InferRequestType<(PitchRequest['grounds']['$post'])>;
export type CreateGroundPayload = CreateGroundRequest["json"];

type UpdateGroundRequest = InferRequestType<(PitchRequest['grounds'][':groundId']['$patch'])>;
export type UpdateGroundPayload = UpdateGroundRequest["json"];

export type PitchDraftContextType = CreatePitchPayload & {
    media: Media[],
    amenities: Amenity[],
    grounds: GroundDraftType[]
};
