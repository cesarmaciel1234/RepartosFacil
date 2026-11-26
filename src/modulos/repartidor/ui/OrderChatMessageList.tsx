"use client";

import React from "react";
import {
  ShieldCheck,
  Store,
  Truck,
  User,
} from "lucide-react";
import type { OrderChatMessage } from "./OrderChatSheet";

interface OrderChatMessageListProps {
  messages: OrderChatMessage[];
  effectiveRole: "client" | "driver";
  embedded: boolean;
  scrollRef: { current: HTMLDivElement | null };
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export function OrderChatMessageList({
  messages,
  effectiveRole,
  embedded,
  scrollRef,
  onScroll,
}: OrderChatMessageListProps) {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className={`min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4 ${
        embedded ? "bg-slate-50/60" : effectiveRole === "driver" ? "bg-white" : ""
      }`}
    >
      {messages.map((message) => {
        const isSystem = (message.authorRole as string) === "system";
        if (isSystem) {
          return (
            <div key={message.id} className="my-2 flex w-full flex-col items-center">
              <div
                className={`flex w-full flex-col gap-1.5 rounded-2xl border p-3 text-center ${
                  embedded
                    ? "border-amber-200 bg-amber-50 shadow-sm"
                    : effectiveRole === "driver"
                    ? "border-yellow-200 bg-yellow-50 shadow-sm"
                    : "border-amber-500/50 bg-amber-950/50 shadow-lg"
                }`}
              >
                <div
                  className={`flex items-center justify-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider ${
                    embedded || effectiveRole === "driver" ? "text-yellow-900" : "text-amber-400"
                  }`}
                >
                  <ShieldCheck
                    className={`h-3.5 w-3.5 ${
                      embedded || effectiveRole === "driver" ? "text-yellow-700" : "text-amber-400"
                    }`}
                  />
                  <span>{message.authorName || "Custodio del Sistema"}</span>
                  <span
                    className={`font-normal ${
                      embedded || effectiveRole === "driver" ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    · {message.timestamp}
                  </span>
                </div>
                <p
                  className={`text-[12px] font-medium leading-snug ${
                    embedded || effectiveRole === "driver" ? "text-slate-800" : "text-amber-100"
                  }`}
                >
                  {message.content}
                </p>
              </div>
            </div>
          );
        }

        const isMe = message.authorRole === effectiveRole;
        const isDriver = message.authorRole === "driver";
        const isClient = message.authorRole === "client";
        const isCompany = message.authorRole === "company";

        return (
          <div
            key={message.id}
            className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
          >
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px]">
              {isDriver && (
                <span
                  className={`flex items-center gap-1 font-bold ${
                    embedded ? "text-emerald-700" : effectiveRole === "driver" ? "text-yellow-900" : "text-emerald-400"
                  }`}
                >
                  <Truck className="h-3 w-3" />
                  {message.authorName} {isMe ? "(Tú)" : "(Repartidor)"}
                </span>
              )}
              {isClient && (
                <span
                  className={`flex items-center gap-1 font-bold ${
                    embedded ? "text-blue-700" : effectiveRole === "driver" ? "text-blue-700" : "text-blue-400"
                  }`}
                >
                  <User className="h-3 w-3" />
                  {message.authorName} {isMe ? "(Tú)" : "(Cliente)"}
                </span>
              )}
              {isCompany && (
                <span
                  className={`flex items-center gap-1 font-bold ${
                    embedded ? "text-amber-700" : effectiveRole === "driver" ? "text-yellow-800" : "text-amber-400"
                  }`}
                >
                  <Store className="h-3 w-3" />
                  {message.authorName}
                </span>
              )}
              <span className="text-slate-500">{message.timestamp}</span>
            </div>

            <div
              className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-md ${
                effectiveRole === "driver" && !embedded
                  ? isMe
                    ? "rounded-br-xs bg-[#FFE600] text-[#2D3277]"
                    : isCompany
                    ? "rounded-bl-xs border border-yellow-200 bg-yellow-50 text-slate-800"
                    : isDriver
                    ? "rounded-bl-xs border border-yellow-200 bg-white text-slate-800"
                    : "rounded-bl-xs border border-slate-200 bg-white text-slate-800"
                  : embedded
                  ? isMe
                    ? "rounded-br-xs bg-blue-600 text-white"
                    : isCompany
                    ? "rounded-bl-xs border border-amber-200 bg-white text-slate-800"
                    : isDriver
                    ? "rounded-bl-xs border border-emerald-100 bg-emerald-50 text-slate-800"
                    : "rounded-bl-xs border border-blue-100 bg-white text-slate-800"
                  : isMe
                  ? effectiveRole === "driver"
                    ? "rounded-br-xs bg-emerald-600 text-white"
                    : "rounded-br-xs bg-blue-600 text-white"
                  : isCompany
                  ? "rounded-bl-xs border border-amber-500/30 bg-slate-800 text-amber-100"
                  : isDriver
                  ? "rounded-bl-xs border border-emerald-500/40 bg-emerald-950/80 text-emerald-100"
                  : "rounded-bl-xs border border-blue-500/40 bg-blue-950/80 text-blue-100"
              }`}
            >
              <div className="flex items-end justify-between gap-2">
                <p className="flex-1 break-words">{message.content}</p>
                {isMe && (
                  <span
                    className={`inline-flex items-center text-[10.5px] font-black shrink-0 pl-1 select-none leading-none ${
                      message.isRead
                        ? (effectiveRole === "driver" && !embedded ? "text-blue-700" : "text-sky-300")
                        : "opacity-60 text-current"
                    }`}
                    title={message.isRead ? "Leído por el destinatario (Confirmación ✓✓)" : "Enviado al chat ✓"}
                  >
                    {message.isRead ? "✓✓" : "✓"}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
