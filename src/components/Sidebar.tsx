"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart3, CalendarDays, Key, FileText, Menu, PanelLeftClose } from "lucide-react";
import { useState } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false); // 默认侧边栏展开

  const navItems = [
    { name: "仪表盘", path: "/", icon: LayoutDashboard },
    { name: "深入分析", path: "/analytics", icon: BarChart3 },
    { name: "交易日历", path: "/calendar", icon: CalendarDays },
    { name: "AI 报告", path: "/reports", icon: FileText, highlight: true },
    { name: "账号配置", path: "/accounts", icon: Key },
  ];

  return (
    <aside 
      className={`
        border-r border-border flex-shrink-0 flex flex-col py-6 
        bg-panel/30 backdrop-blur-md sticky top-0 h-screen transition-all duration-300 z-50
        ${isCollapsed ? "w-16 items-center" : "w-56 items-stretch"}
        hidden md:flex
      `}
    >
       {/* 顶部 Logo 与 折叠按钮 */}
       <div className={`flex items-center gap-3 px-3 md:px-5 mb-10 ${isCollapsed ? "justify-center" : "justify-between"}`}>
         <div className="flex items-center gap-3">
           <div className="w-9 h-9 rounded-xl bg-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/30">
             T
           </div>
           {!isCollapsed && <span className="font-bold text-lg text-white tracking-wide truncate">Dashboard</span>}
         </div>
         
         {!isCollapsed && (
           <button 
             onClick={() => setIsCollapsed(true)}
             className="p-1.5 text-textMuted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
           >
             <PanelLeftClose size={18} />
           </button>
         )}
       </div>

       {isCollapsed && (
         <button 
           onClick={() => setIsCollapsed(false)}
           className="mb-8 p-2 text-textMuted hover:text-white hover:bg-white/5 rounded-lg transition-colors mx-auto"
         >
           <Menu size={20} />
         </button>
       )}
       
       <nav className="flex-1 flex flex-col space-y-2 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.path} 
                href={item.path} 
                className={`
                  flex items-center gap-3 p-3 rounded-xl transition-all group relative
                  ${isCollapsed ? "justify-center" : ""}
                  ${isActive ? (item.highlight ? "bg-blue-500/10 text-blue-400" : "bg-white/10 text-white") : "hover:bg-white/5 text-textMuted hover:text-white"}
                  ${item.highlight && !isActive ? "hover:text-blue-400" : ""}
                `}
              >
                <Icon size={20} className="flex-shrink-0" />
                
                {!isCollapsed && (
                   <span className="font-medium truncate">{item.name}</span>
                )}

                {/* 折叠状态下的悬浮提示 */}
                {isCollapsed && (
                  <span className={`absolute left-full ml-3 px-2 py-1 bg-panel border border-border text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 ${isActive ? "text-white" : ""}`}>
                    {item.name}
                  </span>
                )}
              </Link>
            )
          })}
       </nav>
    </aside>
  );
}
