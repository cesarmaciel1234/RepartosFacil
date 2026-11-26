"use client";

import React, { useState } from "react";
import { DriverOrder, DriverProfile } from "../motor/tipos";
import { saveDriverProfile } from "../motor/driverService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, ArrowRight, User, Lock, Bike, Car, Sparkles, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, setDoc } from "@/firebase/local-firestore";

interface ModalDriverAuthProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pendingOrder: DriverOrder | null;
  onSuccess: (driverId: string) => void;
}

export function ModalDriverAuth({
  isOpen,
  onOpenChange,
  pendingOrder,
  onSuccess,
}: ModalDriverAuthProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [vehicle, setVehicle] = useState<"Motorcycle" | "Bicycle" | "Car">("Motorcycle");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { toast } = useToast();
  const firestore = useFirestore();

  // Función de inicio de sesión con backend y base de datos
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
        throw new Error(data.detail || "Usuario o contraseña incorrectos");
      }
      if (!data.user || !data.access_token) {
        throw new Error("El servicio de autenticación devolvió una respuesta incompleta");
      }
      const user = data.user;
      const token = data.access_token;
      if (user.role !== "Driver" || user.isAnonymous !== false || typeof user.id !== "string" || !user.id) {
        throw new Error("Ingresá con una cuenta registrada de repartidor.");
      }

      // Crear objeto de perfil con rol Driver
      const driverId = user.id || user.uid || "repartidor-01";
      const profile: DriverProfile = {
        id: driverId,
        uid: driverId,
        firstName: user.firstName || user.displayName || "Lucas Motomensajero",
        role: "Driver",
        vehicleType: vehicle,
        availabilityStatus: "Available",
        createdAt: new Date().toISOString(),
      };

      // Guardar token y usuario repartidor aislado (sin pisar cuenta de comprador)
      saveDriverProfile(profile, token);

      // Sincronizar documento en la colección driverProfiles de la BD
      if (firestore) {
        try {
          await setDoc(doc(firestore, "driverProfiles", driverId), {
            id: driverId,
            firstName: profile.firstName,
            email: user.email,
            role: "Driver",
            vehicleType: vehicle,
            availabilityStatus: "Available",
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (dbErr) {
          console.warn("Aviso guardando en driverProfiles:", dbErr);
        }
      }

      toast({
        title: "¡Sesión iniciada!",
        description: `Bienvenido de nuevo, ${profile.firstName}.`,
      });

      onSuccess(driverId);
      onOpenChange(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  // Función de registro de nuevo repartidor
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
          role: "Driver",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || "No se pudo registrar el repartidor");
      }

      const data = await res.json();
      const user = data.user;
      if (!user || !data.access_token) {
        throw new Error("El servicio de autenticación devolvió una respuesta incompleta");
      }
      if (user.role !== "Driver" || user.isAnonymous !== false || typeof user.id !== "string" || !user.id) {
        throw new Error("El servicio no confirmó una cuenta de repartidor válida.");
      }
      const driverId = user.id || `driver-${Date.now().toString(36)}`;

      const profile: DriverProfile = {
        id: driverId,
        uid: driverId,
        firstName: name.trim(),
        role: "Driver",
        vehicleType: vehicle,
        availabilityStatus: "Available",
        createdAt: new Date().toISOString(),
      };

      saveDriverProfile(profile, data.access_token);

      // Guardar en la colección driverProfiles de la base de datos
      if (firestore) {
        try {
          await setDoc(doc(firestore, "driverProfiles", driverId), {
            id: driverId,
            firstName: name.trim(),
            email,
            role: "Driver",
            vehicleType: vehicle,
            availabilityStatus: "Available",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn("Aviso guardando nuevo driver en BD:", dbErr);
        }
      }

      toast({
        title: "¡Cuenta creada!",
        description: `Bienvenido a Reparto Fácil, ${name.trim()}.`,
      });

      onSuccess(driverId);
      onOpenChange(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar repartidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-slate-200 text-slate-900 w-[94vw] max-w-sm p-5 rounded-3xl shadow-xl">
        <DialogHeader className="text-left">
          <div className="w-11 h-11 rounded-2xl bg-yellow-100 text-yellow-800 flex items-center justify-center mb-1 shadow-sm">
            <Truck className="w-6 h-6" />
          </div>
          <DialogTitle className="text-lg font-black text-slate-900">
            {tab === "login" ? "Acceso de Repartidor" : "Registrar Repartidor"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            {pendingOrder
              ? `Iniciá sesión para tomar el pedido #${pendingOrder.id}. Una vez logueado, tu sesión queda guardada.`
              : "Conectate a la central de repartos. Tu sesión quedará guardada en el dispositivo."}
          </DialogDescription>
        </DialogHeader>

        {/* Pestañas Iniciar Sesión / Registrarse */}
        <div className="grid grid-cols-2 p-1 bg-slate-50 rounded-2xl border border-slate-200 my-2">
          <button
            type="button"
            onClick={() => { setTab("login"); setErrorMsg(null); }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              tab === "login"
                ? "bg-[#FFE600] text-[#2D3277] shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setErrorMsg(null); }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              tab === "register"
                ? "bg-[#FFE600] text-[#2D3277] shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Mensaje de error visual */}
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3.5 pt-1">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Usuario o Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  placeholder="repartidor o tu email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl pl-9 pr-3 h-10 text-xs focus:ring-yellow-400 focus:border-yellow-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl pl-9 pr-3 h-10 text-xs focus:ring-yellow-400 focus:border-yellow-400"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-2xl bg-[#FFE600] hover:bg-yellow-300 text-[#2D3277] font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-yellow-500/20 active:scale-98 transition-all"
            >
              <span>{loading ? "Conectando a la central..." : "INICIAR SESIÓN"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3 pt-1">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Nombre y Apellido *
              </label>
              <Input
                placeholder="Ej. Lucas Motomensajero"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl px-3 h-10 text-xs focus:ring-yellow-400 focus:border-yellow-400"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Usuario o Email *
              </label>
              <Input
                placeholder="lucas@repartofacil.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl px-3 h-10 text-xs focus:ring-yellow-400 focus:border-yellow-400"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Contraseña (mínimo 8 caracteres) *
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl px-3 h-10 text-xs focus:ring-yellow-400 focus:border-yellow-400"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Vehículo de Reparto
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setVehicle("Motorcycle")}
                  className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-0.5 text-[11px] font-bold transition-all ${
                    vehicle === "Motorcycle"
                      ? "bg-yellow-100 border-yellow-400 text-yellow-900"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  <Bike className="w-4 h-4" />
                  <span>Moto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVehicle("Bicycle")}
                  className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-0.5 text-[11px] font-bold transition-all ${
                    vehicle === "Bicycle"
                      ? "bg-yellow-100 border-yellow-400 text-yellow-900"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  <Bike className="w-4 h-4" />
                  <span>Bici</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVehicle("Car")}
                  className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-0.5 text-[11px] font-bold transition-all ${
                    vehicle === "Car"
                      ? "bg-yellow-100 border-yellow-400 text-yellow-900"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  <Car className="w-4 h-4" />
                  <span>Auto</span>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-2xl bg-[#FFE600] hover:bg-yellow-300 text-[#2D3277] font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-yellow-500/20 active:scale-98 transition-all"
            >
              <span>{loading ? "Creando cuenta..." : "CREAR CUENTA DE REPARTIDOR"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
