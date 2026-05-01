"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  FileText,
  Key,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  RefreshCw,
  UserCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { authApi, type AuthUser } from "@/lib/api-client";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const navItems = [
    { name: "数据看板", path: "/", icon: LayoutDashboard },
    { name: "深入分析", path: "/analytics", icon: BarChart3 },
    { name: "交易日历", path: "/calendar", icon: CalendarDays },
    { name: "数据同步", path: "/sync", icon: RefreshCw },
    { name: "AI 报告", path: "/reports", icon: FileText, highlight: true },
    { name: "账号配置", path: "/accounts", icon: Key },
  ];

  useEffect(() => {
    authApi.me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await authApi.logout().catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside
      className={`
        border-r border-border flex-shrink-0 flex flex-col py-6
        bg-panel/30 backdrop-blur-md sticky top-0 h-screen transition-all duration-300 z-50
        ${isCollapsed ? "w-16 items-center" : "w-56 items-stretch"}
        hidden md:flex
      `}
    >
      <div className={`flex items-center gap-3 px-3 md:px-5 mb-10 ${isCollapsed ? "justify-center" : "justify-between"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/30">
            T
          </div>
          {!isCollapsed && <span className="font-bold text-lg text-white tracking-wide truncate">Dashboard</span>}
        </div>

        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 text-textMuted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            aria-label="收起侧边栏"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="mb-8 p-2 text-textMuted hover:text-white hover:bg-white/5 rounded-lg transition-colors mx-auto"
          aria-label="展开侧边栏"
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

              {!isCollapsed && <span className="font-medium truncate">{item.name}</span>}

              {isCollapsed && (
                <span className={`absolute left-full ml-3 px-2 py-1 bg-panel border border-border text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 ${isActive ? "text-white" : ""}`}>
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pt-4 border-t border-border/60">
        <div className={`flex items-center gap-3 p-2 rounded-lg ${isCollapsed ? "justify-center" : ""}`}>
          <UserCircle size={20} className="text-textMuted flex-shrink-0" />
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-white truncate">
                {user?.name || user?.email || "Account"}
              </div>
              <div className="text-[11px] text-textMuted truncate">{user?.email}</div>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className={`mt-2 w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-textMuted hover:text-white hover:bg-white/5 ${isCollapsed ? "justify-center" : ""}`}
          title="退出登录"
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="font-medium truncate">退出登录</span>}
        </button>
      </div>
    </aside>
  );
}
