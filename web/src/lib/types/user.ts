import type { client, InferData } from "#/lib/client";

export type User = InferData<typeof client.auth.session.$get>['user'];
export type NotificationChannel = User['preferences']['notifications'][number]; 
export type Language = User['preferences']['language']; 
