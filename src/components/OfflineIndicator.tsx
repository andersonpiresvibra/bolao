import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="mx-4 mt-2 bg-amber-500 text-white px-3 py-2 rounded-[6px] text-[11px] font-bold flex items-center gap-2 shadow-sm">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Modo offline — exibindo resultados salvos em cache.</span>
    </div>
  );
};
