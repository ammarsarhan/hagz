import { QueryClient } from "@tanstack/react-query";

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 1000 * 30,
      },
    },
  });

let client: QueryClient | undefined;

export const getQueryClient = () => {
  if (!client) client = createClient();
  return client;
};
