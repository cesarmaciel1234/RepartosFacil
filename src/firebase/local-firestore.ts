export type DocumentData = Record<string, any>;

export interface DocumentReference<T = DocumentData> {
  type: "document";
  path: string;
  id: string;
}

export interface CollectionReference<T = DocumentData> {
  type: "collection";
  path: string;
  id: string;
}

export interface Query<T = DocumentData> {
  type: "query";
  path: string;
  conditions: string[];
  orderByField?: string;
  orderDirection?: "asc" | "desc";
  limitCount?: number;
  __memo?: boolean;
}

export type SetOptions = { merge?: boolean };

export function collection(_firestore: unknown, ...segments: string[]): CollectionReference {
  const path = segments.join("/");
  return { type: "collection", path, id: path.split("/").pop() || path };
}

export function doc(_firestore: unknown, ...segments: string[]): DocumentReference {
  const path = segments.join("/");
  return { type: "document", path, id: segments.at(-1) || path };
}

export function query<T>(
  ref: CollectionReference<T>,
  ...constraints: unknown[]
): Query<T> {
  const result: Query<T> = { type: "query", path: ref.path, conditions: [] };
  for (const constraint of constraints) {
    const value = constraint as any;
    if (value?.kind === "where") result.conditions.push(`${value.field}:${value.operator}:${value.value}`);
    if (value?.kind === "orderBy") {
      result.orderByField = value.field;
      result.orderDirection = value.direction;
    }
    if (value?.kind === "limit") result.limitCount = value.count;
  }
  return result;
}

export function where(field: string, operator: string, value: unknown) {
  const normalized = Array.isArray(value) ? value.join(",") : String(value);
  return { kind: "where", field, operator, value: normalized };
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc") {
  return { kind: "orderBy", field, direction };
}

export function limit(count: number) {
  return { kind: "limit", count };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export function arrayUnion(...values: unknown[]) {
  return { __arrayUnion: values };
}

export function arrayRemove(...values: unknown[]) {
  return { __arrayRemove: values };
}

export async function setDoc(ref: DocumentReference, data: DocumentData, _options?: SetOptions) {
  try {
    const response = await fetch(`/api/db/${encodeURI(ref.path)}`, {
      method: "PATCH",
      headers: authHeaders(ref.path),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      console.warn("No se pudo guardar el documento:", response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn("No se pudo guardar el documento:", error);
    return null;
  }
}

export async function addDoc(ref: CollectionReference, data: DocumentData) {
  try {
    const response = await fetch(`/api/db/${encodeURI(ref.path)}`, {
      method: "POST",
      headers: authHeaders(ref.path),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      console.warn("No se pudo crear el documento:", response.status);
      return null;
    }
    return (await response.json()) as DocumentReference;
  } catch (error) {
    console.warn("No se pudo crear el documento:", error);
    return null;
  }
}

export async function updateDoc(ref: DocumentReference, data: DocumentData) {
  try {
    const response = await fetch(`/api/db/${encodeURI(ref.path)}`, {
      method: "PATCH",
      headers: authHeaders(ref.path),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      console.warn("No se pudo actualizar el documento:", response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn("No se pudo actualizar el documento:", error);
    return null;
  }
}

export async function deleteDoc(ref: DocumentReference) {
  try {
    const response = await fetch(`/api/db/${encodeURI(ref.path)}`, {
      method: "DELETE",
      headers: authHeaders(ref.path),
    });
    if (!response.ok) console.warn("No se pudo eliminar el documento:", response.status);
  } catch (error) {
    console.warn("No se pudo eliminar el documento:", error);
  }
}

function authHeaders(path: string) {
  const root = path.split("/")[0];
  const key = root === "clients" ? "repartofacil_client_token"
    : root === "driverProfiles" ? "repartofacil_driver_token"
    : "repartofacil_token";
  const token = typeof window !== "undefined" ? localStorage.getItem(key) : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function localGetDocument(ref: DocumentReference) {
  try {
    const response = await fetch(`/api/db/${encodeURI(ref.path)}`, { headers: authHeaders(ref.path) });
    if (response.status === 404 || !response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function localGetCollection(ref: CollectionReference | Query) {
  try {
    const params = new URLSearchParams();
    if (ref.type === "query") {
      const queryRef = ref as Query;
      for (const condition of queryRef.conditions) params.append("where", condition);
      if (queryRef.orderByField) {
        params.append("orderBy", `${queryRef.orderByField}:${queryRef.orderDirection || "asc"}`);
      }
      if (queryRef.limitCount) params.append("limit", String(queryRef.limitCount));
    }
    const url = `/api/db/${encodeURI(ref.path)}${params.size ? `?${params.toString()}` : ""}`;
    const response = await fetch(url, { headers: authHeaders(ref.path) });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}
