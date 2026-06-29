import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface Props {
  message: string;
  onClose?: () => void;
}

export function ErrorAlert({ message, onClose }: Props) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm flex-1">{message}</p>
      {onClose && (
        <button onClick={onClose} className="text-red-400 hover:text-red-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
