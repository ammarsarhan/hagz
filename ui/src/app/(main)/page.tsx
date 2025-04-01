"use client";

import { useAuthContext } from "@/context/auth";

export default function Home() {
  const { user, owner } = useAuthContext();

  return (
      <div>
        {
          !user && !owner &&
          "not logged in aslan"
        }
        {
          user &&
          "logged in as a user"
        }
        {
          owner &&
          "logged in as an owner"
        }
      </div>
  );
}
