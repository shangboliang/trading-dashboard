"use client";

import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { NetWorthDisplay } from "@/components/NetWorthDisplay";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/10 via-background to-background relative pb-8">
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>

      <footer className="h-10 bg-panel/80 border-t border-border flex items-center justify-between px-6 text-xs text-textMuted shrink-0 z-50 backdrop-blur-md relative">
        <div className="flex items-center gap-2 font-mono">
          <Wallet size={12} className="text-blue-400" />
          <span>余额:</span>
          <NetWorthDisplay />
        </div>

        <div className="flex items-center gap-6 font-medium">
          <a href="#" className="hover:text-blue-400 transition-colors">Twitter</a>
          <a href="#" className="hover:text-indigo-400 transition-colors">Discord</a>
          <a href="#" className="hover:text-sky-400 transition-colors">Telegram</a>
        </div>
      </footer>
    </div>
  );
}
