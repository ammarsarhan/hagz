"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { send } from "./errors";

export interface Admin {
  id: string;
  name: string;
  email: string;
}

const AdminContext = createContext<{ admin: Admin; update: (admin: Admin) => void } | null>(null);

// The signed-in admin, for every dashboard page. Signed out, it goes to sign in before drawing
// anything, so no page ever shows without a session.
export function AdminSession({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin>();

  useEffect(() => {
    void send(api.GET("/v1/auth/admin/me")).then((result) => {
      if (result.ok) setAdmin(result.data);
      else window.location.replace("/admin/login");
    });
  }, []);

  if (!admin) return null;
  return (
    <AdminContext.Provider value={{ admin, update: setAdmin }}>{children}</AdminContext.Provider>
  );
}

const useSession = () => {
  const session = useContext(AdminContext);
  if (!session) throw new Error("useAdmin is only for pages inside AdminSession.");
  return session;
};

export const useAdmin = () => useSession().admin;

// For the Account page: after a rename, every page (the rail's name included) shows the new one.
export const useUpdateAdmin = () => useSession().update;

export const signOut = async () => {
  await send(api.DELETE("/v1/auth/admin/sessions/current"));
  window.location.assign("/admin/login");
};
