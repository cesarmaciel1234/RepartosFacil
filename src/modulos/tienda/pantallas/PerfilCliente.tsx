"use client";

import React, { useState } from "react";
import {
  Check,
  ChevronRight,
  Headphones,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { saveClientProfile, type ClientProfile } from "@/modulos/repartidor/motor/driverService";
import { AppVersion } from "@/components/AppVersion";

interface PerfilClienteProps {
  clientProfile: ClientProfile | null;
  isClientAuthenticated: boolean;
  deliveryAddress: string;
  onLogin: () => void;
  onLogout: () => void;
  onEditAddress: () => void;
  onSwitchToDriver: () => void;
}

export function PerfilCliente({
  clientProfile,
  isClientAuthenticated,
  deliveryAddress,
  onLogin,
  onLogout,
  onEditAddress,
  onSwitchToDriver,
}: PerfilClienteProps) {
  const displayName = clientProfile?.displayName || "Cliente Reparto Fácil";
  const initial = displayName.charAt(0).toUpperCase();

  const [editingField, setEditingField] = useState<"name" | "phone" | "email" | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const startEdit = (field: "name" | "phone" | "email") => {
    setEditingField(field);
    if (field === "name") setTempValue(clientProfile?.displayName || "");
    else if (field === "phone") setTempValue(clientProfile?.phone || "");
    else if (field === "email") setTempValue(clientProfile?.email || "");
  };

  const cancelEdit = () => {
    setEditingField(null);
    setTempValue("");
  };

  const handleSaveField = () => {
    if (!clientProfile || !editingField) return;
    const val = tempValue.trim();
    const updated: ClientProfile = {
      ...clientProfile,
      displayName: editingField === "name" ? (val || clientProfile.displayName) : clientProfile.displayName,
      phone: editingField === "phone" ? val : clientProfile.phone,
      email: editingField === "email" ? (val || clientProfile.email) : clientProfile.email,
    };
    saveClientProfile(updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("repartofacil-client-auth"));
      window.dispatchEvent(new Event("repartofacil-auth"));
    }
    setEditingField(null);
    setSaveSuccessMsg("✓ Guardado correctamente");
    setTimeout(() => setSaveSuccessMsg(null), 2500);
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <article className="flex items-center gap-4 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-2xl font-black text-white shadow-md shadow-blue-600/20">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-extrabold text-slate-900">{displayName}</h2>
          <p className="truncate text-sm text-slate-500">
            {clientProfile?.email || "Ingresá para guardar tus datos y pedidos"}
          </p>
        </div>
        {clientProfile ? (
          <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-[10px] font-bold text-blue-700">
            Cliente
          </span>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className="flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
          >
            <LogIn className="h-3.5 w-3.5" />
            Iniciar sesión
          </button>
        )}
      </article>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Datos personales
          </h2>
          {saveSuccessMsg && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 animate-in fade-in">
              {saveSuccessMsg}
            </span>
          )}
        </div>
        {clientProfile && (
          <>
            {/* Nombre */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <UserRound className="h-4 w-4 shrink-0 text-blue-600" />
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium text-slate-500">Nombre</span>
                {editingField === "name" ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveField();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="h-8 flex-1 rounded-lg border border-blue-400 bg-white px-2.5 text-sm font-semibold text-slate-800 outline-none ring-2 ring-blue-100"
                      placeholder="Tu nombre y apellido"
                    />
                    <button
                      type="button"
                      onClick={handleSaveField}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
                      title="Guardar nombre"
                      aria-label="Guardar nombre"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                      title="Cancelar"
                      aria-label="Cancelar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {clientProfile.displayName}
                  </span>
                )}
              </div>
              {editingField !== "name" && (
                <button
                  type="button"
                  onClick={() => startEdit("name")}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  title="Editar nombre"
                  aria-label="Editar nombre"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Teléfono */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Phone className="h-4 w-4 shrink-0 text-blue-600" />
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium text-slate-500">Teléfono de contacto</span>
                {editingField === "phone" ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="tel"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveField();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="h-8 flex-1 rounded-lg border border-blue-400 bg-white px-2.5 text-sm font-semibold text-slate-800 outline-none ring-2 ring-blue-100"
                      placeholder="Ej.: 11 2345 6789"
                    />
                    <button
                      type="button"
                      onClick={handleSaveField}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
                      title="Guardar teléfono"
                      aria-label="Guardar teléfono"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                      title="Cancelar"
                      aria-label="Cancelar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {clientProfile.phone || "Teléfono sin agregar"}
                  </span>
                )}
              </div>
              {editingField !== "phone" && (
                <button
                  type="button"
                  onClick={() => startEdit("phone")}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  title="Editar teléfono"
                  aria-label="Editar teléfono"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Mail className="h-4 w-4 shrink-0 text-blue-600" />
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium text-slate-500">Correo electrónico</span>
                {editingField === "email" ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="email"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveField();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="h-8 flex-1 rounded-lg border border-blue-400 bg-white px-2.5 text-sm font-semibold text-slate-800 outline-none ring-2 ring-blue-100"
                      placeholder="ejemplo@correo.com"
                    />
                    <button
                      type="button"
                      onClick={handleSaveField}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
                      title="Guardar correo"
                      aria-label="Guardar correo"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                      title="Cancelar"
                      aria-label="Cancelar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {clientProfile.email || "Sin correo"}
                  </span>
                )}
              </div>
              {editingField !== "email" && (
                <button
                  type="button"
                  onClick={() => startEdit("email")}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  title="Editar correo"
                  aria-label="Editar correo"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        )}

        {/* Dirección de entrega */}
        <button
          type="button"
          onClick={onEditAddress}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50/50"
        >
          <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-slate-500">Dirección de entrega</span>
            <span className="block truncate text-sm font-semibold text-slate-800">{deliveryAddress}</span>
          </span>
          <span className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600">
            <Pencil className="h-4 w-4 shrink-0" />
          </span>
        </button>
      </section>

      <div className="space-y-3">
        {!isClientAuthenticated && (
          <button
            type="button"
            onClick={onSwitchToDriver}
            className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-left transition-colors hover:bg-blue-100/70"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Truck className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block font-bold text-slate-900">Conectarse como repartidor</span>
              <span className="block text-xs text-slate-600">Ver pedidos disponibles y repartir</span>
            </span>
            <ChevronRight className="h-4 w-4 text-blue-600" />
          </button>
        )}

        <a
          href="https://wa.me/5491100000000"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50"
        >
          <Headphones className="h-5 w-5 text-blue-600" />
          <span className="flex-1 text-sm font-bold text-slate-800">Ayuda y soporte</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </a>
      </div>

      {clientProfile && (
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      )}
      <AppVersion />
    </section>
  );
}
