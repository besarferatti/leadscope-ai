import { Loader2 } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';

interface Props {
  message?: string;
}

export function LoadingSpinner({ message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="flex items-center gap-3">
        <BrandLogo className="h-8 w-auto object-contain" />
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" aria-label="Loading" />
      </div>
      {message && <p className="text-slate-400 text-sm">{message}</p>}
    </div>
  );
}
