import type { Metadata } from "next";
import "./globals.css";
import { Wallet } from "lucide-react";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Trading Dashboard",
  description: "Personal Trading Journal & Analytics Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased flex flex-col h-screen bg-background text-textMain font-sans overflow-hidden">
        
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
            <Wallet size={12} className="text-blue-400"/>
            <span>净值:</span>
            <span className="font-bold text-white tracking-wider">$1,086.24</span>
          </div>
          
          <div className="flex items-center gap-6 font-medium">
             <a href="#" className="hover:text-blue-400 transition-colors flex items-center gap-1.5">
               <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 22.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
               Twitter
             </a>
             <a href="#" className="hover:text-indigo-400 transition-colors flex items-center gap-1.5">
               <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
               Discord
             </a>
             <a href="#" className="hover:text-sky-400 transition-colors flex items-center gap-1.5">
               <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a5.8 5.8 0 0 0-.164.003L12 0zm5.115 7.42c.11.002.217.027.316.074.204.095.344.296.368.52.024.223-.068.444-.242.58l-2.074 1.623-1.06 4.14c-.035.137-.116.257-.228.34-.112.083-.25.127-.39.123-.14-.004-.275-.056-.38-.146l-2.47-2.107-1.52.924c-.11.067-.236.103-.365.103-.13 0-.256-.036-.365-.103L5.49 11.39c-.198-.12-.323-.33-.335-.56-.012-.23.093-.45.28-.592l9.74-7.46c.15-.115.34-.176.53-.167h.005zm-4.745 6.06l1.3-5.074-6.385 4.885 2.186 1.864 2.898-1.675z"/></svg>
               Telegram
             </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
