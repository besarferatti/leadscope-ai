import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface Props {
  currentPage: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  children: ReactNode;
  pageTitle?: string;
}

export function DashboardLayout({ currentPage, onNavigate, children }: Props) {
  return (
    <div className="flex min-h-screen bg-slate-950 luxury-grid">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <main className="flex-1 min-w-0 overflow-auto bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 pt-20 pb-8 sm:px-6 sm:pt-8 lg:px-8 lg:py-10 lg:pl-10">
          {children}
        </div>
      </main>
    </div>
  );
}
