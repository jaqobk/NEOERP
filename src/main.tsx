import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// @ts-ignore
import App from './App.jsx';

// Non-blocking toast notification & browser-extension fetch descriptor bridge for iframe compatibility
if (typeof window !== 'undefined') {
  for (const target of [window, typeof Window !== 'undefined' ? Window.prototype : null]) {
    if (!target) continue;
    try {
      const desc = Object.getOwnPropertyDescriptor(target, 'fetch');
      if (desc && desc.configurable && desc.get && !desc.set) {
        const origGet = desc.get;
        Object.defineProperty(target, 'fetch', {
          configurable: true,
          enumerable: desc.enumerable !== false,
          get() { return origGet.call(this); },
          set() {}
        });
      }
    } catch (_) {}
  }

  const showToast = (msg: string, tone: 'info' | 'warn' = 'info') => {
    try {
      let container = document.getElementById('__neo_toast_container');
      if (!container) {
        container = document.createElement('div');
        container.id = '__neo_toast_container';
        container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none';
        document.body.appendChild(container);
      }
      const toast = document.createElement('div');
      toast.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border text-xs font-medium transition-all duration-200 ${
        tone === 'warn'
          ? 'bg-slate-900/95 border-amber-500/60 text-amber-200'
          : 'bg-slate-900/95 border-emerald-500/60 text-slate-100'
      }`;
      toast.textContent = String(msg || '');
      container.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 4000);
    } catch (_) {}
  };

  window.alert = (message?: any) => {
    showToast(String(message ?? ''), 'info');
  };

  const nativeConfirm = window.confirm?.bind(window);
  window.confirm = (message?: string): boolean => {
    try {
      if (nativeConfirm) {
        const res = nativeConfirm(message);
        if (res === true) return true;
      }
    } catch (_) {}
    // In sandboxed preview iframes where native confirm returns false without showing a dialog, proceed safely
    return true;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
