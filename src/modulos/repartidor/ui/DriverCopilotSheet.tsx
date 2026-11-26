"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Sparkles, Send, Bot, User } from "lucide-react";

interface CopilotMessage {
  role: "model" | "user";
  content: string;
}

interface DriverCopilotSheetProps {
  onBack: () => void;
  activeOrdersCount: number;
}

export function DriverCopilotSheet({
  onBack,
  activeOrdersCount,
}: DriverCopilotSheetProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      role: "model",
      content: "¡Hola! Soy Copo. Esta conversación está en modo de prueba: puedo decirte cuántas entregas tenés, pero todavía no analizo rutas ni tráfico real.",
    },
  ]);
  const [input, setInput] = useState("");
  const handleSend = (userText: string) => {
    if (!userText.trim()) return;

    const text = userText.trim();
    const reply = /pedido|entrega|orden/i.test(text)
      ? `Tenés ${activeOrdersCount} entrega(s) en tu ruta activa.`
      : "Todavía no puedo consultar rutas, distancias ni tráfico real. Revisá Mi Ruta para ver tus pedidos.";
    setMessages((current) => [
      ...current,
      { role: "user", content: text },
      { role: "model", content: reply },
    ]);
    setInput("");
  };

  return (
    <div className="min-h-0 flex-1 bg-white text-slate-900 flex flex-col">
        <div className="p-3 border-b border-slate-100 flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Volver a mensajes" className="h-9 w-9 flex items-center justify-center rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-900">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-yellow-100 text-yellow-800 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">Copiloto IA · Copo</h2>
            <p className="text-[11px] text-slate-500 font-medium">Modo de prueba · respuestas simuladas</p>
          </div>
        </div>

        {/* Mensajes */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "model" && (
                <div className="w-6 h-6 rounded-lg bg-yellow-100 text-yellow-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`p-3 rounded-2xl text-xs max-w-[80%] leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#FFE600] text-[#2D3277] rounded-br-xs"
                    : "bg-slate-50 text-slate-700 border border-slate-200 rounded-bl-xs"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-200 bg-white space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {["¿Cuántas entregas tengo?", "Ver mi ruta"].map((chip) => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                className="text-[10px] bg-slate-50 hover:bg-yellow-50 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <Input
              placeholder="Escribile a tu copiloto..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
              className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs h-10 rounded-xl focus-visible:ring-yellow-400"
            />
            <Button
              onClick={() => handleSend(input)}
              className="h-10 px-3 rounded-xl bg-[#FFE600] hover:bg-yellow-300 text-[#2D3277] shrink-0"
              aria-label="Enviar mensaje a Copo"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
    </div>
  );
}
