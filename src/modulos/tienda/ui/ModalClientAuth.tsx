"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Lock, ArrowRight, ShoppingBag, AlertCircle, Phone, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, setDoc } from "@/firebase/local-firestore";
import { saveClientProfile, generateUniqueEntityId } from "@/modulos/repartidor/motor/driverService";
import { readRegisteredCustomer } from "../motor/pedidoService";

interface ModalClientAuthProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ModalClientAuth({
  isOpen,
  onOpenChange,
  onSuccess,
}: ModalClientAuthProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { toast } = useToast();
  const firestore = useFirestore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUser = identifier.trim();
    if (!cleanUser) {
      setErrorMsg("Ingresá tu usuario o email");
      return;
    }
    if (!password) {
      setErrorMsg("Ingresá tu contraseña");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanUser, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(res.status === 401
          ? "Usuario o contraseña incorrectos."
          : data.detail || "No se pudo iniciar sesión.");
      }
      if (!data.user || !data.access_token) {
        throw new Error("El servicio de autenticación devolvió una respuesta incompleta");
      }
      const user = data.user;
      const token = data.access_token;
      if (user.role !== "Client" || user.isAnonymous !== false || typeof user.id !== "string" || !user.id) {
        throw new Error("Ingresá con una cuenta registrada de comprador.");
      }

      const userAccountId = user.userId || user.uid || generateUniqueEntityId("usr_cli");
      const clientProfileId = user.id || generateUniqueEntityId("cli");
      const registered = await readRegisteredCustomer(clientProfileId, `Bearer ${token}`);
      const registeredName = typeof registered?.displayName === "string" ? registered.displayName.trim() : "";
      const authName = typeof user.displayName === "string" ? user.displayName.trim() : "";
      const customerName = authName && !["cliente", "cliente frecuente"].includes(authName.toLocaleLowerCase("es-AR"))
        ? authName
        : registeredName || authName || "Cliente Frecuente";

      const clientProfile = {
        id: clientProfileId,
        uid: userAccountId,
        userId: userAccountId,
        displayName: customerName,
        email: user.email,
        role: "Client" as const,
        phone: user.phone || (typeof registered?.phone === "string" ? registered.phone.trim() : ""),
        address: user.address || (typeof registered?.address === "string" ? registered.address.trim() : ""),
        createdAt: new Date().toISOString(),
      };

      // Guardar sesión persistente de comprador (separada de repartidores)
      saveClientProfile(clientProfile, token);

      toast({
        title: "¡Sesión iniciada!",
        description: "Ya podés continuar con tu compra.",
      });

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Ingresá tu nombre y apellido");
      return;
    }
    if (!identifier.trim()) {
      setErrorMsg("Ingresá un email o nombre de usuario");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const email = identifier.includes("@") ? identifier.trim() : `${identifier.trim()}@repartofacil.com`;
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          display_name: name.trim(),
          role: "Client",
          phone: phone.trim(),
          address: address.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "No se pudo crear la cuenta");
      }
      if (!data.user || !data.access_token) {
        throw new Error("El servicio de autenticación devolvió una respuesta incompleta");
      }
      const user = data.user;
      const token = data.access_token;
      if (user.role !== "Client" || user.isAnonymous !== false || typeof user.id !== "string" || !user.id) {
        throw new Error("El servicio no confirmó una cuenta de comprador válida.");
      }
      const userAccountId = user.userId || user.uid || generateUniqueEntityId("usr_cli");
      const clientProfileId = user.id || generateUniqueEntityId("cli");

      const clientProfile = {
        id: clientProfileId,
        uid: userAccountId,
        userId: userAccountId,
        displayName: user.displayName || name.trim(),
        email,
        role: "Client" as const,
        phone: user.phone || phone.trim(),
        address: user.address || address.trim(),
        createdAt: new Date().toISOString(),
      };

      // Guardar sesión persistente de comprador (separada de repartidores)
      saveClientProfile(clientProfile, token);

      let contactSaved = false;
      if (firestore) {
        try {
          const result = await setDoc(doc(firestore, "clients", clientProfileId), {
            id: clientProfileId,
            displayName: name.trim(),
            email,
            role: "Client",
            phone: phone.trim(),
            address: address.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          contactSaved = result !== null;
        } catch (dbErr) {
          console.warn("Aviso guardando en clients:", dbErr);
        }
      }

      toast({
        title: "¡Cuenta creada con éxito!",
        description: contactSaved
          ? `Bienvenido a Reparto Fácil, ${name.trim()}.`
          : "La cuenta se creó, pero no se pudieron guardar tus datos de contacto en el servidor.",
        variant: contactSaved ? "default" : "destructive",
      });

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al crear cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 w-[94vw] max-w-sm p-5 rounded-3xl shadow-2xl">
        <DialogHeader className="text-left">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-1 shadow-md">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <DialogTitle className="text-lg font-black text-white">
            {tab === "login" ? "Acceso de Cliente" : "Crear Cuenta de Cliente"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 mt-0.5">
            {tab === "login"
              ? "Iniciá sesión para guardar tus compras y direcciones favoritas."
              : "Registrate en segundos para hacer pedidos rápidos y seguir tus envíos."}
          </DialogDescription>
        </DialogHeader>

        {/* Pestañas Iniciar Sesión / Registrarse */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 my-2">
          <button
            type="button"
            onClick={() => { setTab("login"); setErrorMsg(null); }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              tab === "login"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setErrorMsg(null); }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              tab === "register"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Registrarme
          </button>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3.5 pt-1">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Usuario o Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  placeholder="cliente o tu email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-xl pl-9 pr-3 h-10 text-xs focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-xl pl-9 pr-3 h-10 text-xs focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-98 transition-all"
            >
              <span>{loading ? "Iniciando sesión..." : "INICIAR SESIÓN COMO CLIENTE"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            {loading && (
              <p role="status" className="text-center text-xs text-slate-400">
                El servidor puede tardar hasta un minuto en iniciar.
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3 pt-1">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Nombre y Apellido *
              </label>
              <Input
                placeholder="Ej. Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white rounded-xl px-3 h-10 text-xs focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Usuario o Email *
              </label>
              <Input
                placeholder="juan@email.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white rounded-xl px-3 h-10 text-xs focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Contraseña (mínimo 8 caracteres) *
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white rounded-xl px-3 h-10 text-xs focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Teléfono
                </label>
                <Input
                  placeholder="+54 9 341..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-xl px-3 h-10 text-xs focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Domicilio
                </label>
                <Input
                  placeholder="Calle y altura"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-xl px-3 h-10 text-xs focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-98 transition-all"
            >
              <span>{loading ? "Creando cuenta..." : "CREAR MI CUENTA"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
