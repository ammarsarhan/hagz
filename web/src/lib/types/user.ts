import type { client, InferData } from "#/lib/client";

export type User = InferData<typeof client.auth.session.$get>['user'];