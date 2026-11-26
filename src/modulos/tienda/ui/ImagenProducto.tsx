"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

interface ImagenProductoProps {
  src?: string;
  alt: string;
  className?: string;
}

export function ImagenProducto({ src, alt, className = "" }: ImagenProductoProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${alt}: foto pendiente`}
      className={`${className} flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-500`}
    >
      <ImageOff className="h-5 w-5" aria-hidden="true" />
      <span className="text-[10px] font-semibold">Foto pendiente</span>
    </div>
  );
}
