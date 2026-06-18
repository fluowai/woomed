import { useState, useEffect, useCallback } from 'react';
import { Download, X, RefreshCw } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsVisible(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setIsVisible(false);
  }, [deferredPrompt]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        setUpdateReady(true);
      });
    }
  }, []);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  if (isInstalled && !updateReady) return null;

  return (
    <>
      {updateReady && (
        <div className="fixed bottom-24 lg:bottom-6 left-4 right-4 z-[200] bg-blue-600 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-3 min-w-0">
            <RefreshCw size={20} className="shrink-0 animate-spin duration-1000" />
            <span className="text-sm font-bold">Nova versão disponível!</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-white text-blue-600 rounded-xl font-black text-xs uppercase tracking-wider whitespace-nowrap hover:bg-blue-50 transition-colors"
          >
            Atualizar
          </button>
        </div>
      )}

      {isVisible && deferredPrompt && !updateReady && (
        <div className="fixed bottom-24 lg:bottom-6 left-4 right-4 z-[200] bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
              <Download size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-800">Instalar Consultio Med</p>
              <p className="text-xs text-slate-500 font-medium">Adicione à tela inicial para acesso rápido</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-teal-600 text-white rounded-xl font-black text-xs uppercase tracking-wider whitespace-nowrap hover:bg-teal-700 transition-colors shadow-md"
            >
              Instalar
            </button>
            <button
              onClick={() => { setIsVisible(false); setDeferredPrompt(null); }}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
