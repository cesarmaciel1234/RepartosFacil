'use client';

const firebaseApp = { name: "repartofacil-local" };
const firestore = { name: "repartofacil-sqlite" };

export const localAuth = {
  async anonymous(displayName: string) {
    return request("/api/auth/anonymous", "POST", { display_name: displayName });
  },
  async email(email: string, password: string, displayName?: string) {
    return request("/api/auth/login", "POST", { email, password, display_name: displayName });
  },
};

export function initializeFirebase() {
  return { firebaseApp, firestore, auth: localAuth };
}

export function getSdks() {
  return { firebaseApp, firestore, auth: localAuth };
}

async function request(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  const result = await response.json();
  localStorage.setItem("repartofacil_token", result.access_token);
  localStorage.setItem("repartofacil_user", JSON.stringify(result.user));
  window.dispatchEvent(new Event("repartofacil-auth"));
  return {
    user: {
      uid: result.user.uid,
      displayName: result.user.displayName,
      email: result.user.email,
      isAnonymous: result.user.isAnonymous,
    },
  };
}

export * from "./provider";
export * from "./client-provider";
export * from "./firestore/use-collection";
export * from "./firestore/use-doc";
export * from "./non-blocking-updates";
export * from "./non-blocking-login";
