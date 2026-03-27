/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  OptiPharma — Threat Analysis Dashboard                                ║
 * ║                                                                        ║
 * ║  Post-scan results view. Displays the complete ThreatReport in a       ║
 * ║  grid-based glassmorphism layout:                                      ║
 * ║  • Final Verdict banner (Emerald/Crimson/Amber)                        ║
 * ║  • SSIM score gauge with animated fill                                 ║
 * ║  • Extracted text display                                              ║
 * ║  • Chemical compound match/mismatch indicators                         ║
 * ║  • Pipeline metadata (processing time, version)                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { motion } from 'framer-motion';

// ─── Animation Variants ──────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } },
};

export default function ThreatDashboard({ report, onNewScan }) {
  if (!report) return null;

  const {
    verdict,
    confidence,
    rejection_reason,
    ssim,
    compound_verification,
    extracted_text,
    processing_time_ms,
    pipeline_version,
  } = report;

  const isVerified = verdict === 'VERIFIED';
  const isCounterfeit = verdict === 'COUNTERFEIT';

  // ─── Verdict Config ────────────────────────────────────────
  const verdictConfig = {
    VERIFIED: {
      label: 'VERIFIED — AUTHENTIC',
      icon: '✓',
      className: 'verdict-verified',
      glow: 'shadow-emerald-500/20',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500',
    },
    COUNTERFEIT: {
      label: 'COUNTERFEIT DETECTED',
      icon: '✗',
      className: 'verdict-counterfeit',
      glow: 'shadow-red-500/20',
      color: 'text-red-400',
      bg: 'bg-red-500',
    },
    INCONCLUSIVE: {
      label: 'INCONCLUSIVE',
      icon: '?',
      className: 'verdict-inconclusive',
      glow: 'shadow-amber-500/20',
      color: 'text-amber-400',
      bg: 'bg-amber-500',
    },
  };

  const vc = verdictConfig[verdict] || verdictConfig.INCONCLUSIVE;

  // ─── SSIM gauge color ──────────────────────────────────────
  const getSSIMColor = (score) => {
    if (score >= 0.95) return 'bg-emerald-500';
    if (score >= 0.80) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ═══ VERDICT BANNER ═══════════════════════════════════ */}
      <motion.div variants={item}>
        <div className={`${vc.className} rounded-2xl p-6 shadow-xl ${vc.glow}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className={`w-14 h-14 rounded-2xl ${vc.bg}/20 flex items-center justify-center`}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
              >
                <span className={`text-3xl font-bold ${vc.color}`}>{vc.icon}</span>
              </motion.div>
              <div>
                <motion.h2
                  className={`text-xl font-bold tracking-tight ${vc.color}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {vc.label}
                </motion.h2>
                {rejection_reason && (
                  <p className="text-sm mt-0.5 opacity-70">{rejection_reason}</p>
                )}
              </div>
            </div>

            {/* Confidence Score */}
            <motion.div
              className="text-right"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">Confidence</p>
              <p className={`text-3xl font-bold font-mono ${vc.color}`}>
                {confidence?.toFixed(1)}%
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ═══ METRICS GRID ═════════════════════════════════════ */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* ─── SSIM Score Card ──────────────────────── */}
        <motion.div variants={item} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono text-pharma-slate-500 uppercase tracking-wider">
              SSIM Analysis
            </h3>
            <span className={`text-xs font-mono font-bold ${
              ssim?.passed_gate ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {ssim?.passed_gate ? 'GATE OPEN' : 'GATE CLOSED'}
            </span>
          </div>

          {/* Score Display */}
          <div className="flex items-end gap-2 mb-3">
            <span className="text-4xl font-bold font-mono text-white">
              {ssim?.score ? (ssim.score * 100).toFixed(1) : '0'}
            </span>
            <span className="text-lg text-pharma-slate-500 mb-1">%</span>
          </div>

          {/* Gauge Bar */}
          <div className="gauge-track">
            <motion.div
              className={`gauge-fill ${getSSIMColor(ssim?.score || 0)}`}
              initial={{ width: 0 }}
              animate={{ width: `${(ssim?.score || 0) * 100}%` }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            />
          </div>

          {/* Threshold Marker */}
          <div className="relative mt-1">
            <div className="absolute left-[95%] -translate-x-1/2 flex flex-col items-center">
              <div className="w-[1px] h-2 bg-white/30" />
              <span className="text-[9px] text-pharma-slate-600 mt-0.5">95%</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[10px] text-pharma-slate-600 font-mono">
            <span>REF: {ssim?.reference_logo_used || 'N/A'}</span>
          </div>
        </motion.div>

        {/* ─── Extracted Text Card ──────────────────── */}
        <motion.div variants={item} className="glass-card p-5">
          <h3 className="text-xs font-mono text-pharma-slate-500 uppercase tracking-wider mb-3">
            Extracted Text (OCR)
          </h3>

          {extracted_text ? (
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-pharma-slate-600 font-mono">BATCH NO.</span>
                <p className="text-sm font-mono text-white font-medium mt-0.5">
                  {extracted_text.batch_number || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-pharma-slate-600 font-mono">BRAND</span>
                <p className="text-sm font-mono text-white font-medium mt-0.5">
                  {extracted_text.brand_name || 'N/A'}
                </p>
              </div>
              {extracted_text.raw_text && (
                <div>
                  <span className="text-[10px] text-pharma-slate-600 font-mono">RAW TEXT</span>
                  <div className="mt-1 p-2 rounded-lg bg-pharma-slate-800 border border-white/5 max-h-24 overflow-y-auto">
                    <p className="text-[11px] font-mono text-pharma-slate-500 break-all leading-relaxed">
                      {extracted_text.raw_text}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-24">
              <p className="text-xs text-pharma-slate-600">
                OCR skipped — SSIM gate rejected
              </p>
            </div>
          )}
        </motion.div>

        {/* ─── Compound Verification Card ──────────── */}
        <motion.div variants={item} className="glass-card p-5">
          <h3 className="text-xs font-mono text-pharma-slate-500 uppercase tracking-wider mb-3">
            Compound Verification
          </h3>

          {compound_verification ? (
            <div className="space-y-3">
              {/* Match Status */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                compound_verification.match
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-red-500/10 border border-red-500/20'
              }`}>
                <span className={`text-lg ${compound_verification.match ? 'text-emerald-400' : 'text-red-400'}`}>
                  {compound_verification.match ? '✓' : '✗'}
                </span>
                <div>
                  <p className={`text-xs font-bold ${
                    compound_verification.match ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {compound_verification.match ? 'COMPOUNDS MATCH' : 'MISMATCH DETECTED'}
                  </p>
                  <p className="text-[10px] text-pharma-slate-500 font-mono">
                    {compound_verification.match_percentage?.toFixed(1)}% match rate
                  </p>
                </div>
              </div>

              {/* Expected vs Extracted */}
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-pharma-slate-600 font-mono">EXPECTED</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {compound_verification.expected_compounds?.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10
                                               text-[10px] font-mono text-pharma-slate-500">
                        {c}
                      </span>
                    ))}
                    {(!compound_verification.expected_compounds?.length) && (
                      <span className="text-[10px] text-pharma-slate-600">No data from Truth Ledger</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-pharma-slate-600 font-mono">EXTRACTED</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {compound_verification.extracted_compounds?.map((c, i) => {
                      const isMatch = compound_verification.expected_compounds?.some(
                        (exp) => exp.toLowerCase() === c.toLowerCase()
                      );
                      return (
                        <span key={i} className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                          isMatch
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                        }`}>
                          {c}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-24">
              <p className="text-xs text-pharma-slate-600">
                Verification skipped — SSIM gate rejected
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ═══ PIPELINE METADATA BAR ════════════════════════════ */}
      <motion.div variants={item}>
        <div className="glass-card px-5 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6 text-[10px] font-mono text-pharma-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="opacity-60">⏱</span>
              <span>{processing_time_ms?.toFixed(0) || '—'}ms</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="opacity-60">🔧</span>
              <span>Pipeline v{pipeline_version || '1.0.0'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="opacity-60">📋</span>
              <span>{report.timestamp ? new Date(report.timestamp).toLocaleTimeString() : '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="opacity-60">🛡️</span>
              <span>SSIM Threshold: 95%</span>
            </div>
          </div>

          {/* New Scan Button */}
          <button
            onClick={onNewScan}
            className="px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider
                       bg-white/5 border border-white/10 text-white
                       hover:bg-white/10 hover:border-white/20 transition-all"
          >
            ← New Scan
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
