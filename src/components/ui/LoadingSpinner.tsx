import { Loader2 } from 'lucide-react';

interface Props {
  message?: string;
}

export function LoadingSpinner({ message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      {message && <p className="text-slate-400 text-sm">{message}</p>}
    </div>
  );
}
