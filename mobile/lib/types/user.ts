import { InferResponseType } from "hono/client";
import { client } from "@/lib/client";

type SessionResponse = InferResponseType<typeof client.auth.session.$get, 200>;
export type User = SessionResponse['data']['user'];