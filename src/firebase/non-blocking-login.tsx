'use client';

import { localAuth } from "./index";

export type UserCredential = { user: { uid: string; displayName: string | null; email: string | null; isAnonymous: boolean } };

export function initiateAnonymousSignIn(_authInstance: unknown): Promise<UserCredential> {
  const name = localStorage.getItem("repartofacil_pending_name") || "Repartidor";
  return localAuth.anonymous(name);
}

export async function initiateGoogleSignIn(_authInstance: unknown): Promise<UserCredential> {
  throw new Error("Google sign-in is not available in local mode");
}
