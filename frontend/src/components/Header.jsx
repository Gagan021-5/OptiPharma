import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const fallbackNavItems = [{ label: 'Scanner', href: '#scanner-workspace' }];

function getStatusConfig(isScanning, scanResult) {
  if (isScanning) {
    return {
      label: 'Analyzing',
      accentClass: 'text-cyan-300',
      badgeClass: 'border-cyan-400/20 bg-cyan-500/10',
      dotClass: 'bg-cyan-400 animate-pulse',
      summary: 'Running the full verification pipeline right now.',
    };
  }

  if (scanResult?.verdict === 'VERIFIED') {
    return {
      label: 'Verified',
      accentClass: 'text-emerald-300',
      badgeClass: 'border-emerald-400/20 bg-emerald-500/10',
      dotClass: 'bg-emerald-400 shadow-lg shadow-emerald-400/40',
      summary: 'Result looks authentic and ready for review.',
    };
  }

  if (scanResult?.verdict === 'COUNTERFEIT') {
    return {
      label: 'Threat detected',
      accentClass: 'text-red-300',
      badgeClass: 'border-red-400/20 bg-red-500/10',
      dotClass: 'bg-red-400 shadow-lg shadow-red-400/40',
      summary: 'Suspicious output detected. Review the findings carefully.',
    };
  }

  if (scanResult) {
    return {
      label: 'Scan complete',
      accentClass: 'text-amber-300',
      badgeClass: 'border-amber-400/20 bg-amber-500/10',
      dotClass: 'bg-amber-400 shadow-lg shadow-amber-400/40',
      summary: 'The scan finished and the dashboard is ready.',
    };
  }

  return {
    label: 'Ready',
    accentClass: 'text-cyan-300',
    badgeClass: 'border-cyan-400/20 bg-cyan-500/10',
    dotClass: 'bg-cyan-400 shadow-lg shadow-cyan-400/40',
    summary: 'Position a medicine strip and start a new verification run.',
  };
}

export default function Header({ isScanning, scanResult, navItems = fallbackNavItems }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const status = getStatusConfig(isScanning, scanResult);
  const verdictLabel = scanResult?.verdict ? scanResult.verdict.replace(/_/g, ' ') : 'Waiting for first scan';

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [isScanning, scanResult]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-pharma-slate-900/75 backdrop-blur-2xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[76px] items-center gap-3 sm:min-h-[88px]">
          <a
            href={navItems[0]?.href || '#scanner-workspace'}
            className="group flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
            onClick={closeMenu}
          >
            <div className="relative shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg shadow-cyan-500/25 sm:h-12 sm:w-12">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>

              {isScanning && (
                <motion.div
                  className="absolute inset-0 rounded-2xl border-2 border-cyan-400"
                  animate={{ scale: [1, 1.35, 1], opacity: [0.55, 0, 0.55] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                Opti<span className="text-cyan-400">Pharma</span>
              </h1>
              <p className="truncate text-[10px] font-mono uppercase tracking-[0.28em] text-pharma-slate-500 sm:text-[11px]">
                Pharmaceutical Verification Console
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm text-pharma-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${status.badgeClass}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${status.dotClass}`} />
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${status.accentClass}`}>
                  {status.label}
                </p>
                <p className="text-xs text-pharma-slate-500">{status.summary}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Platform</p>
              <p className="mt-1 text-sm text-white">Verification Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              aria-label="Toggle navigation menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              <span className="relative h-5 w-5">
                <span className={`absolute left-0 top-0 block h-[2px] w-5 rounded-full bg-current transition ${isMenuOpen ? 'translate-y-[9px] rotate-45' : 'translate-y-[3px]'}`} />
                <span className={`absolute left-0 top-1/2 block h-[2px] w-5 -translate-y-1/2 rounded-full bg-current transition ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
                <span className={`absolute left-0 bottom-0 block h-[2px] w-5 rounded-full bg-current transition ${isMenuOpen ? '-translate-y-[9px] -rotate-45' : '-translate-y-[3px]'}`} />
              </span>
            </button>
          </div>
        </div>

        <div className="pb-4 lg:hidden">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3 shadow-lg shadow-black/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">
                  System status
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${status.dotClass}`} />
                  <span className={`text-xs font-semibold uppercase tracking-[0.24em] ${status.accentClass}`}>
                    {status.label}
                  </span>
                </div>
              </div>

              <div className="sm:text-right">
                <p className="text-sm text-white">{status.summary}</p>
                <p className="mt-1 text-[11px] text-pharma-slate-500">Verification pipeline</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden border-t border-white/10 bg-pharma-slate-900/95 lg:hidden"
          >
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
              <div className="grid gap-3">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <div>
                      <p className="text-base font-semibold text-white">{item.label}</p>
                      <p className="text-sm text-pharma-slate-500">Jump to this section</p>
                    </div>

                    <svg className="h-5 w-5 text-pharma-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                    </svg>
                  </a>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-[1.5rem] border px-4 py-4 ${status.badgeClass}`}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">
                    Live system
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${status.dotClass}`} />
                    <div>
                      <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${status.accentClass}`}>
                        {status.label}
                      </p>
                      <p className="mt-1 text-sm text-pharma-slate-400">{status.summary}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">
                    Current session
                  </p>
                  <div className="mt-3 space-y-3 text-sm text-pharma-slate-400">
                    <div className="flex items-center justify-between gap-3">
                      <span>Latest state</span>
                      <span className="text-white">{verdictLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Pipeline</span>
                      <span className="text-white">Vision + OCR + Ledger</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Version</span>
                      <span className="text-white">v1.0.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isScanning && (
        <motion.div
          className="h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </header>
  );
}
