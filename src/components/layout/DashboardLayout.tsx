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
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:pl-8">
          {children}
        </div>
      </main>
    </div>
  );
}
