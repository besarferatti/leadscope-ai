import React, { useState } from 'react';
import {
  LayoutDashboard, Users, CreditCard, Database, Search, FileText,
  MessageSquare, Settings, LogOut, ChevronRight, Crosshair, Shield, X, Menu,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminOverview } from './AdminOverview';
import { AdminUsers } from './AdminUsers';
import { AdminPlans } from './AdminPlans';
import { AdminLeads } from './AdminLeads';
import { AdminSearches } from './AdminSearches';
import { AdminAudits } from './AdminAudits';
import { AdminMessages } from './AdminMessages';
import { AdminSystem } from './AdminSystem';

type AdminSection =
  | 'overview'
  | 'users'
  | 'plans'
  | 'leads'
  | 'searches'
  | 'audits'
  | 'messages'
  | 'system';

interface Props {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  adminPage?: string;
}

const navItems: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'plans', label: 'Plans', icon: CreditCard },
  { id: 'leads', label: 'Leads', icon: Database },
  { id: 'searches', label: 'Lead Searches', icon: Search },
  { id: 'audits', label: 'Audits', icon: FileText },
  { id: 'messages', label: 'Outreach Messages', icon: MessageSquare },
  { id: 'system', label: 'System Settings', icon: Settings },
];

export function AdminPage({ onNavigate, adminPage }: Props) {
  const { user, profile, signOut } = useAuth();
  const [section, setSection] = useState<AdminSection>((adminPage as AdminSection) ?? 'overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  function renderSection() {
    switch (section) {
      case 'overview': return <AdminOverview />;
      case 'users': return <AdminUsers />;
      case 'plans': return <AdminPlans />;
      case 'leads': return <AdminLeads onNavigate={onNavigate} />;
      case 'searches': return <AdminSearches />;
      case 'audits': return <AdminAudits />;
      case 'messages': return <AdminMessages />;
      case 'system': return <AdminSystem />;
      default: return <AdminOverview />;
    }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <Crosshair className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <span className="text-white font-bold text-sm">LeadScope</span>
          <span className="text-blue-400 font-bold text-sm"> AI</span>
        </div>
      </div>

      {/* Admin badge */}
      <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        <span className="text-red-400 text-xs font-semibold">Admin Dashboard</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setSection(item.id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-slate-800 pt-4 space-y-1">
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-150"
        >
          <LayoutDashboard className="w-4 h-4" />
          User Dashboard
        </button>
        <div className="px-3 py-1.5">
          <p className="text-slate-500 text-xs truncate">{user?.email}</p>
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
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-60 bg-slate-950 border-r border-slate-800 transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-slate-950 border-r border-slate-800 h-screen sticky top-0 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}
