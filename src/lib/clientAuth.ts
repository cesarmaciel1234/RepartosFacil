"use client";

export function authHeaders(role: "Client" | "Driver"): Record<string, string> {
  const key = role === "Driver" ? "repartofacil_driver_token" : "repartofacil_client_token";
  const token = localStorage.getItem(key);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
