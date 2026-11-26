'use client';

import { useEffect, useState } from "react";
import { CollectionReference, Query, localGetCollection } from "@/firebase/local-firestore";

export function useCollection<T = any>(
  ref: (CollectionReference | Query) | null | undefined,
) {
  const [data, setData] = useState<(T & { id: string })[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ref) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    const load = async () => {
      try {
        const value = await localGetCollection(ref);
        if (active) setData(value as (T & { id: string })[]);
        if (active) setError(null);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught : new Error(String(caught)));
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    const interval = window.setInterval(load, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [ref?.path, ref?.type === "query" ? JSON.stringify(ref) : ref?.path]);

  return { data, isLoading, error };
}
