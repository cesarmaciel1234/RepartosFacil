'use client';

import React, { DependencyList, createContext, useContext, useEffect, useMemo, useState } from "react";
import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";

export interface LocalUser {
  uid: string;
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: string;
  isAnonymous: boolean;
}

interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: unknown;
  firestore: unknown;
  auth: unknown;
  user: LocalUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider = ({ children, firebaseApp, firestore, auth }: {
  children: React.ReactNode;
  firebaseApp: unknown;
  firestore: unknown;
  auth: unknown;
}) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const syncUser = () => {
      const raw = localStorage.getItem("repartofacil_user");
      setUser(raw ? JSON.parse(raw) : null);
      setIsUserLoading(false);
    };
    syncUser();
    window.addEventListener("repartofacil-auth", syncUser);
    return () => window.removeEventListener("repartofacil-auth", syncUser);
  }, []);

  const contextValue = useMemo(() => ({
    areServicesAvailable: true,
    firebaseApp,
    firestore,
    auth,
    user,
    isUserLoading,
    userError: null,
  }), [firebaseApp, firestore, auth, user, isUserLoading]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context?.areServicesAvailable) throw new Error("Local Firebase-compatible services are not available.");
  return context;
};

export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().firestore;
export const useFirebaseApp = () => useFirebase().firebaseApp;

export const useUser = () => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T & { __memo?: boolean } {
  const memoized = useMemo(factory, deps);
  if (typeof memoized === "object" && memoized !== null) {
    (memoized as T & { __memo?: boolean }).__memo = true;
  }
  return memoized as T & { __memo?: boolean };
}
