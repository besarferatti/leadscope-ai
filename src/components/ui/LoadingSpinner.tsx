import { Loader2 } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';

interface Props {
  message?: string;
}

export function LoadingSpinner({ message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="relative grid h-10 w-10 place-items-center">
        <BrandLogo variant="icon" className="h-8 w-8 object-contain" />
        <Loader2 className="absolute h-10 w-10 animate-spin text-blue-500" />
      </div>
      {message && <p className="text-slate-400 text-sm">{message}</p>}
    </div>
  );
}
