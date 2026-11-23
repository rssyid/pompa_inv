"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppData } from "./AppDataProvider";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Users,
  Wrench,
  X,
} from "lucide-react";

export interface ClientSessionUser {
  userId: number;
  username: string;
  name: string;
  role: "admin" | "petugas";
  defaultEstateId: number | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "Operasional" | "Administrasi";
}

const OPERATIONAL_NAV: NavItem[] = [
  { href: "/", label: "Ringkasan", icon: LayoutDashboard, group: "Operasional" },
  { href: "/pumps", label: "Daftar Pompa", icon: Wrench, group: "Operasional" },
  { href: "/reports", label: "Laporan", icon: BarChart3, group: "Operasional" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/master", label: "Master Data", icon: Database, group: "Administrasi" },
  { href: "/admin/pumps", label: "Kelola Pompa", icon: Settings2, group: "Administrasi" },
  { href: "/admin/users", label: "Kelola User", icon: Users, group: "Administrasi" },
  { href: "/admin/import", label: "Import Excel", icon: FileSpreadsheet, group: "Administrasi" },
];

export function AppShell({
  user,
  title,
  subtitle,
  children,
}: {
  user: ClientSessionUser;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { clearSession } = useAppData();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = user.role === "admin" ? [...OPERATIONAL_NAV, ...ADMIN_NAV] : OPERATIONAL_NAV;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    clearSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-field-bg text-field-ink">
      {/* Desktop / Tablet Sidebar */}
      <aside
        aria-label="Navigasi utama"
        className={`no-print hidden md:flex md:flex-col md:border-r md:border-field-border md:bg-field-surface transition-[width] duration-150 ${
          collapsed ? "md:w-[72px]" : "md:w-64"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-field-border px-3">
          {!collapsed && (
            <Link href="/" className="min-w-0 truncate text-sm font-bold tracking-tight text-field-ink">
              POMPA THIP
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA]"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
          {(["Operasional", "Administrasi"] as const).map((group) => {
            const groupItems = navItems.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group}>
                {!collapsed && (
                  <p className="mb-1.5 px-2.5 text-xs font-semibold text-field-muted">
                    {group}
                  </p>
                )}
                <ul className="space-y-1">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={collapsed ? item.label : undefined}
                          aria-label={item.label}
                          aria-current={active ? "page" : undefined}
                          className={`flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                            active
                              ? "border border-[#86EFAC] bg-[#DCFCE7] font-semibold text-[#166534]"
                              : "border border-transparent font-medium text-field-ink hover:bg-field-bg"
                          } ${collapsed ? "justify-center px-0" : ""}`}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-field-border p-3">
          {!collapsed && (
            <div className="mb-2 px-1">
              <p className="truncate text-sm font-semibold text-field-ink">{user.name}</p>
              <p className="text-xs text-field-muted">
                {user.role === "admin" ? "Admin" : "Petugas Lapangan"}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Keluar dari aplikasi"
            title="Keluar"
            className={`flex min-h-[44px] w-full items-center gap-2 rounded-md border border-field-border bg-field-bg px-3 text-sm font-medium text-field-ink hover:bg-[#FEE2E2] hover:text-[#991B1B] ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>{loggingOut ? "Keluar..." : "Keluar"}</span>}
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Mobile Header + Desktop Page Title Header */}
        <header className="no-print border-b border-field-border bg-field-surface px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-field-accent md:hidden">
                PT TH Indoplantation
              </p>
              <h1 className="truncate text-lg font-bold text-field-ink sm:text-xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-field-muted sm:text-sm">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 md:hidden">
              {user.role === "admin" && (
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Buka menu admin"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-field-bg px-3 text-sm font-semibold text-field-ink"
                >
                  <Menu className="h-4 w-4" aria-hidden="true" />
                  <span>Menu</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label="Keluar"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-field-border bg-field-bg text-field-ink"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {/* Admin Sub-Navigation for quick mobile/tablet switching */}
        {user.role === "admin" && pathname.startsWith("/admin") && (
          <nav
            aria-label="Submenu administrasi"
            className="no-print border-b border-field-border bg-field-bg px-4 py-2 sm:px-6"
          >
            <ul className="mx-auto flex max-w-6xl flex-wrap gap-2">
              {ADMIN_NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex min-h-[40px] items-center rounded-md border px-3 text-xs font-semibold ${
                        active
                          ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                          : "border-field-border bg-field-surface text-field-ink hover:bg-[#EAEFEA]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {/* Mobile Admin Drawer */}
        {mobileMenuOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi admin"
            onKeyDown={(e) => {
              if (e.key === "Escape") setMobileMenuOpen(false);
            }}
            className="no-print fixed inset-0 z-50 flex justify-end bg-black/40 md:hidden"
          >
            <div className="flex h-full w-72 max-w-[85vw] flex-col bg-field-surface p-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-field-border pb-3">
                <div>
                  <p className="text-sm font-bold text-field-ink">{user.name}</p>
                  <p className="text-xs text-field-muted">Menu Administrasi</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Tutup menu"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-field-border"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <nav className="mt-4 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm ${
                        active
                          ? "border border-[#86EFAC] bg-[#DCFCE7] font-semibold text-[#166534]"
                          : "font-medium text-field-ink hover:bg-field-bg"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 sm:px-6 md:pb-8"
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-field-border bg-field-surface px-2 py-1.5 md:hidden"
      >
        <ul className="flex items-center justify-around gap-1">
          {OPERATIONAL_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-xs ${
                    active
                      ? "bg-[#DCFCE7] font-semibold text-[#166534]"
                      : "font-medium text-field-muted hover:text-field-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
          {user.role === "admin" && (
            <li className="flex-1">
              <Link
                href="/admin/master"
                aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-xs ${
                  pathname.startsWith("/admin")
                    ? "bg-[#DCFCE7] font-semibold text-[#166534]"
                    : "font-medium text-field-muted hover:text-field-ink"
                }`}
              >
                <Database className="h-4 w-4" aria-hidden="true" />
                <span>Admin</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
