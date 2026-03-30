import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180, damping: 22 } },
};

function getVerdictConfig(verdict) {
  if (verdict === 'VERIFIED') {
    return {
      label: 'Verified - Authentic',
      panelClass: 'verdict-verified',
      accentClass: 'text-emerald-300',
      iconSurfaceClass: 'border border-emerald-400/20 bg-emerald-500/15',
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    };
  }

  if (verdict === 'COUNTERFEIT') {
    return {
      label: 'Counterfeit Detected',
      panelClass: 'verdict-counterfeit',
      accentClass: 'text-red-300',
      iconSurfaceClass: 'border border-red-400/20 bg-red-500/15',
      icon: (
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zm8.25-.75L13.5 4.5a1.732 1.732 0 00-3 0L3.75 15.75A1.732 1.732 0 005.25 18h13.5a1.732 1.732 0 001.5-2.25z" />
        </svg>
      ),
    };
  }

  return {
    label: 'Inconclusive',
    panelClass: 'verdict-inconclusive',
    accentClass: 'text-amber-300',
    iconSurfaceClass: 'border border-amber-400/20 bg-amber-500/15',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9a3 3 0 10-3-3m3 3a3 3 0 013 3c0 1.07-.56 2.01-1.403 2.542-.704.445-1.097 1.018-1.097 1.708V17.25m.008 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  };
}

function getSSIMColor(score) {
  if (score >= 95) return 'bg-emerald-500';
  if (score >= 80) return 'bg-amber-500';
  return 'bg-red-500';
}

function getSummaryChips(ssim, extractedText, compoundVerification) {
  return [
    {
      label: 'SSIM gate',
      value: ssim?.passed_gate ? 'Passed' : 'Blocked',
      className: ssim?.passed_gate
        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
        : 'border-red-400/20 bg-red-500/10 text-red-200',
    },
    {
      label: 'OCR',
      value: extractedText ? 'Captured' : 'Skipped',
      className: extractedText
        ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200'
        : 'border-white/10 bg-white/[0.04] text-pharma-slate-300',
    },
    {
      label: 'Ledger',
      value: compoundVerification
        ? compoundVerification.match
          ? 'Matched'
          : 'Mismatch'
        : 'Skipped',
      className: compoundVerification?.match
        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
        : compoundVerification
          ? 'border-red-400/20 bg-red-500/10 text-red-200'
          : 'border-white/10 bg-white/[0.04] text-pharma-slate-300',
    },
  ];
}

export default function ThreatDashboard({ report, onNewScan }) {
  if (!report) return null;

  const {
    verdict,
    confidence,
    rejection_reason: rejectionReason,
    ssim,
    compound_verification: compoundVerification,
    extracted_text: extractedText,
    processing_time_ms: processingTimeMs,
    pipeline_version: pipelineVersion,
    timestamp,
  } = report;

  const verdictConfig = getVerdictConfig(verdict);
  const confidenceValue = typeof confidence === 'number' ? confidence.toFixed(1) : '--';
  const ssimScore = typeof ssim?.score === 'number' ? (ssim.score * 100).toFixed(1) : '0.0';
  const ssimNumericScore = Number.parseFloat(ssimScore);
  const matchPercentage = typeof compoundVerification?.match_percentage === 'number'
    ? compoundVerification.match_percentage.toFixed(1)
    : '--';
  const timestampLabel = timestamp
    ? new Date(timestamp).toLocaleString([], {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--';
  const summaryChips = getSummaryChips(ssim, extractedText, compoundVerification);

  const overviewCopy = rejectionReason || (
    verdict === 'VERIFIED'
      ? 'Pack identity, extracted text, and compound expectations aligned with the reference profile.'
      : verdict === 'COUNTERFEIT'
        ? 'The strip diverged from the expected visual or chemical profile and should be isolated for review.'
        : 'Some checks completed, but the evidence was not strong enough to confirm authenticity.'
  );

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 sm:space-y-8"
    >
      <motion.section id="results-overview" variants={item} className="section-anchor">
        <div className={`${verdictConfig.panelClass} overflow-hidden rounded-[2rem] p-5 shadow-xl sm:p-7 lg:p-8`}>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] ${verdictConfig.iconSurfaceClass}`}>
                <span className={verdictConfig.accentClass}>{verdictConfig.icon}</span>
              </div>

              <div className="max-w-3xl">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/60">Verification result</p>
                <h2 className={`mt-2 text-3xl font-semibold tracking-tight sm:text-4xl ${verdictConfig.accentClass}`}>
                  {verdictConfig.label}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                  {overviewCopy}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {summaryChips.map((chip) => (
                    <div
                      key={chip.label}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${chip.className}`}
                    >
                      {chip.label}: {chip.value}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[340px]">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/10 px-4 py-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/55">Confidence</p>
                <p className={`mt-3 text-4xl font-semibold ${verdictConfig.accentClass}`}>{confidenceValue}%</p>
                <p className="mt-2 text-sm text-white/60">Combined signal from the vision, OCR, and ledger checks.</p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/10 px-4 py-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-white/55">Processing time</p>
                <p className="mt-3 text-4xl font-semibold text-white">
                  {typeof processingTimeMs === 'number' ? processingTimeMs.toFixed(0) : '--'}
                  <span className="ml-1 text-base text-white/55">ms</span>
                </p>
                <p className="mt-2 text-sm text-white/60">Includes preprocessing, OCR, and backend verification.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <div id="results-metrics" className="section-anchor grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <motion.section variants={item} className="glass-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Visual identity</p>
              <h3 className="mt-1 text-lg font-semibold text-white">SSIM analysis</h3>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] ${
              ssim?.passed_gate
                ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                : 'border-red-400/20 bg-red-500/10 text-red-300'
            }`}>
              {ssim?.passed_gate ? 'Gate open' : 'Gate closed'}
            </span>
          </div>

          <div className="mt-6 flex items-end gap-2">
            <span className="text-5xl font-semibold text-white">{ssimScore}</span>
            <span className="mb-1 text-lg text-pharma-slate-500">%</span>
          </div>

          <div className="mt-5">
            <div className="gauge-track">
              <motion.div
                className={`gauge-fill ${getSSIMColor(ssimNumericScore)}`}
                initial={{ width: 0 }}
                animate={{ width: `${ssimNumericScore}%` }}
                transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
              />
            </div>

            <div className="relative mt-2 h-4">
              <div className="absolute left-[95%] top-0 -translate-x-1/2 text-center">
                <div className="mx-auto h-2 w-px bg-white/30" />
                <span className="block text-[10px] text-pharma-slate-600">95%</span>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Reference logo</p>
            <p className="mt-2 text-sm text-white">{ssim?.reference_logo_used || 'Not available'}</p>
          </div>
        </motion.section>

        <motion.section variants={item} className="glass-card p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">OCR output</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Extracted text</h3>

          {extractedText ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Batch number</p>
                  <p className="mt-2 text-sm font-semibold text-white">{extractedText.batch_number || 'Not found'}</p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Brand</p>
                  <p className="mt-2 text-sm font-semibold text-white">{extractedText.brand_name || 'Not found'}</p>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-white/10 bg-pharma-slate-800/80 p-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Raw text</p>
                <div className="mt-3 max-h-40 overflow-y-auto rounded-2xl border border-white/5 bg-pharma-slate-900/60 p-3">
                  <p className="break-words text-sm leading-6 text-pharma-slate-400">
                    {extractedText.raw_text || 'No raw OCR text returned.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm leading-6 text-pharma-slate-400">
                OCR was skipped because the SSIM gate rejected the strip before text extraction.
              </p>
            </div>
          )}
        </motion.section>

        <motion.section variants={item} className="glass-card p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Ledger check</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Compound verification</h3>

          {compoundVerification ? (
            <div className="mt-5 space-y-4">
              <div className={`rounded-[1.5rem] border p-4 ${
                compoundVerification.match
                  ? 'border-emerald-400/20 bg-emerald-500/10'
                  : 'border-red-400/20 bg-red-500/10'
              }`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${
                  compoundVerification.match ? 'text-emerald-300' : 'text-red-300'
                }`}>
                  {compoundVerification.match ? 'Compounds match' : 'Mismatch detected'}
                </p>
                <p className="mt-2 text-sm text-pharma-slate-100">{matchPercentage}% match rate against the truth ledger.</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Expected compounds</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {compoundVerification.expected_compounds?.length ? (
                      compoundVerification.expected_compounds.map((compound) => (
                        <span
                          key={compound}
                          className="rounded-full border border-white/10 bg-pharma-slate-800 px-3 py-1 text-xs text-pharma-slate-300"
                        >
                          {compound}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-pharma-slate-500">No expected compounds were returned.</span>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Extracted compounds</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {compoundVerification.extracted_compounds?.length ? (
                      compoundVerification.extracted_compounds.map((compound) => {
                        const matchesExpected = compoundVerification.expected_compounds?.some(
                          (expected) => expected.toLowerCase() === compound.toLowerCase(),
                        );

                        return (
                          <span
                            key={compound}
                            className={`rounded-full border px-3 py-1 text-xs ${
                              matchesExpected
                                ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                                : 'border-red-400/20 bg-red-500/10 text-red-200'
                            }`}
                          >
                            {compound}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-sm text-pharma-slate-500">No compounds were extracted from OCR.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm leading-6 text-pharma-slate-400">
                Ledger verification was skipped because the visual gate did not pass.
              </p>
            </div>
          )}
        </motion.section>
      </div>

      <motion.section id="results-session" variants={item} className="section-anchor">
        <div className="glass-card px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Timestamp</p>
                <p className="mt-2 text-sm text-white">{timestampLabel}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Pipeline</p>
                <p className="mt-2 text-sm text-white">v{pipelineVersion || '1.0.0'}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">SSIM threshold</p>
                <p className="mt-2 text-sm text-white">95%</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Confidence</p>
                <p className="mt-2 text-sm text-white">{confidenceValue}%</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onNewScan}
              className="btn-secondary inline-flex w-full items-center justify-center sm:w-auto"
            >
              Start a new scan
            </button>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
