"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { send } from "./errors";

export interface Admin {
  id: string;
  name: string;
  email: string;
}

const AdminContext = createContext<Admin | null>(null);

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
  return <AdminContext.Provider value={admin}>{children}</AdminContext.Provider>;
}

export const useAdmin = () => {
  const admin = useContext(AdminContext);
  if (!admin) throw new Error("useAdmin is only for pages inside AdminSession.");
  return admin;
};

export const signOut = async () => {
  await send(api.DELETE("/v1/auth/admin/sessions/current"));
  window.location.assign("/admin/login");
};
