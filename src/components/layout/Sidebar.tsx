import React, { useState } from 'react';
import {
  LayoutDashboard, Search, Users, Settings, LogOut, Menu, X,
  Crosshair, ChevronRight, Shield, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isAdmin, getPlanBadgeColor, PLANS } from '../../lib/plans';

interface NavItem {
  label: string;
  icon: React.ElementType;
  page: string;
}

const userNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' },
  { label: 'Lead Searches', icon: Search, page: 'searches' },
  { label: 'Leads', icon: Users, page: 'leads' },
  { label: 'Settings', icon: Settings, page: 'settings' },
];

interface Props {
  currentPage: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function Sidebar({ currentPage, onNavigate }: Props) {
  const { user, profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const admin = isAdmin(profile);
  const planName = profile ? (PLANS[profile.current_plan]?.name ?? profile.current_plan) : '';
  const planBadge = profile ? getPlanBadgeColor(profile.current_plan) : '';

  function nav(page: string, params?: Record<string, string>) {
    onNavigate(page, params);
    setMobileOpen(false);
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Crosshair className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-white font-bold text-base leading-none">LeadScope</span>
          <span className="text-blue-400 font-bold text-base leading-none"> AI</span>
        </div>
      </div>

      {/* Admin Panel button */}
      {admin && (
        <div className="px-3 pt-3">
          <button
            onClick={() => nav('admin', { admin_page: 'overview' })}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              currentPage === 'admin'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
            }`}
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Admin Panel</span>
            <ChevronRight className="w-3 h-3 opacity-60" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {userNavItems.map(item => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => nav(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
            </button>
          );
        })}
      </nav>

      {/* User info */}
      <div className="px-3 pb-4 border-t border-slate-800 pt-4 space-y-2">
        <div className="px-3 py-2 rounded-lg bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-slate-300 text-xs font-medium truncate flex-1">
              {profile?.full_name || user?.email?.split('@')[0] || 'User'}
            </p>
            {admin && (
              <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                <Shield className="w-3 h-3" /> Admin
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs truncate">{user?.email}</p>
          {!admin && profile && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`badge text-xs ${planBadge}`}>{planName}</span>
              {profile.current_plan !== 'agency' && profile.current_plan !== 'enterprise' && (
                <button
                  onClick={() => nav('settings')}
                  className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-0.5 transition-colors"
                >
                  <TrendingUp className="w-2.5 h-2.5" /> Upgrade
                </button>
              )}
            </div>
          )}
          {admin && (
            <span className={`mt-1.5 inline-block badge text-xs ${planBadge}`}>{planName}</span>
          )}
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 border-r border-slate-800 transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
        <SidebarContent />
      </aside>

      <aside className="hidden lg:flex flex-col w-64 bg-slate-950 border-r border-slate-800 h-screen sticky top-0 flex-shrink-0">
        <SidebarContent />
      </aside>
    </>
  );
}
