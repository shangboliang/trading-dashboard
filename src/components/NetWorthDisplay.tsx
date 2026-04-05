"use client";

import { useState, useEffect } from "react";
import { accountsApi } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

export function NetWorthDisplay() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBalance() {
      try {
        setLoading(true);
        const data = await accountsApi.getBalance();
        setBalance(data.balance);
      } catch (err) {
        console.error('Failed to load balance:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBalance();
  }, []);

  if (loading) {
    return <Loader2 size={12} className="animate-spin text-blue-400" />;
  }

  return (
    <span className="font-bold text-white tracking-wider">
      ${balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
    </span>
  );
}
