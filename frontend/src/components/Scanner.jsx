import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Webcam from 'react-webcam';
import ScanOverlay from './ScanOverlay';

const API_URL = '/api/analyze';
const AWAITING_SCAN_COPY = 'Awaiting Scan...';
const EXTRACTING_COPY = 'Extracting via AI...';
const NOT_DETECTED_COPY = 'Not detected';

const PIPELINE_STAGES = [
  {
    step: '01',
    title: 'Image preprocessing',
    description: 'Normalizes lighting and edge detail before the medicine strip is evaluated.',
    tag: 'Vision',
  },
  {
    step: '02',
    title: 'Perspective correction',
    description: 'Aligns the strip so logos, text, and compounds stay readable across devices.',
    tag: 'Geometry',
  },
  {
    step: '03',
    title: 'SSIM comparison',
    description: 'Measures visual similarity against approved brand references.',
    tag: 'Identity',
  },
  {
    step: '04',
    title: 'OCR extraction',
    description: 'Reads batch details and pack text using the multimodal pipeline.',
    tag: 'OCR',
  },
  {
    step: '05',
    title: 'Ledger verification',
    description: 'Compares extracted compounds with the truth ledger record from the backend.',
    tag: 'Ledger',
  },
];

const CAPTURE_TIPS = [
  'Use the rear camera when available to improve focus consistency and detail.',
  'Keep the strip flat and fill most of the frame without cutting off the edges.',
  'Avoid glare on foil surfaces so the OCR and logo checks stay reliable.',
];

export default function Scanner({ onScanComplete, isScanning, setIsScanning }) {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [capturedImage, setCapturedImage] = useState(null);
  const [detectedBrand, setDetectedBrand] = useState(AWAITING_SCAN_COPY);
  const [detectedBatch, setDetectedBatch] = useState(AWAITING_SCAN_COPY);
  const [error, setError] = useState(null);
  const [useWebcam, setUseWebcam] = useState(true);
  const [webcamReady, setWebcamReady] = useState(false);

  const webcamConfig = {
    width: 1280,
    height: 720,
    facingMode: { ideal: 'environment' },
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetDetectedFields = () => {
    setDetectedBrand(AWAITING_SCAN_COPY);
    setDetectedBatch(AWAITING_SCAN_COPY);
  };

  const resolveDetectedValue = (value) => {
    if (typeof value !== 'string') {
      return '';
    }

    const normalizedValue = value.trim();
    if (!normalizedValue || normalizedValue.toUpperCase() === 'UNKNOWN') {
      return '';
    }

    return normalizedValue;
  };

  const switchMode = (nextUseWebcam) => {
    setUseWebcam(nextUseWebcam);
    setCapturedImage(null);
    setError(null);
    setWebcamReady(false);
    resetDetectedFields();
    resetFileInput();
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const captureImage = useCallback(() => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();

    if (!imageSrc) {
      setError('Unable to capture an image. Check camera permissions and try again.');
      return;
    }

    setCapturedImage(imageSrc);
    resetDetectedFields();
    setError(null);
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file in JPEG, PNG, or WebP format.');
      return;
    }

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      setUseWebcam(false);
      setCapturedImage(loadEvent.target?.result);
      resetDetectedFields();
      setError(null);
    };

    reader.readAsDataURL(file);
  };

  const dataURLtoFile = (dataUrl, filename = 'capture.jpg') => {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bytes = atob(parts[1]);
    const array = new Uint8Array(bytes.length);

    for (let index = 0; index < bytes.length; index += 1) {
      array[index] = bytes.charCodeAt(index);
    }

    return new File([array], filename, { type: mime });
  };

  const handleAnalyze = async () => {
    if (!capturedImage) {
      setError('Capture or upload an image before starting the analysis.');
      return;
    }

    setIsScanning(true);
    setError(null);
    setDetectedBrand(EXTRACTING_COPY);
    setDetectedBatch(EXTRACTING_COPY);

    try {
      const formData = new FormData();
      formData.append('image', dataURLtoFile(capturedImage));

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || `Server error: ${response.status}`);
      }

      const report = await response.json();
      const resolvedBrand = resolveDetectedValue(report.brandName) || resolveDetectedValue(report.extracted_text?.brand_name) || NOT_DETECTED_COPY;
      const resolvedBatch = resolveDetectedValue(report.batchNumber) || resolveDetectedValue(report.extracted_text?.batch_number) || NOT_DETECTED_COPY;

      setDetectedBrand(resolvedBrand);
      setDetectedBatch(resolvedBatch);
      onScanComplete(report);
    } catch (err) {
      console.error('Scan failed:', err);
      resetDetectedFields();
      setError(err.message || 'Failed to connect to the OptiPharma backend.');
      setIsScanning(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setError(null);
    resetDetectedFields();
    resetFileInput();
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <motion.section
        id="scanner-workspace"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="section-anchor glass-card overflow-hidden p-5 sm:p-6 lg:p-8"
      >
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.26em] text-cyan-300">
              Verification console
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.85rem] lg:leading-tight">
              Operational workspace for medicine strip verification.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-pharma-slate-400 sm:text-base">
              Capture or upload a strip image and let the AI extract product context before the
              truth ledger verifies the medicine automatically.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Capture sources</p>
              <p className="mt-3 text-xl font-semibold text-white">Camera + upload</p>
              <p className="mt-2 text-sm text-pharma-slate-400">Supports live capture and stored inspection images.</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">AI extraction</p>
              <p className="mt-3 text-xl font-semibold text-white">Brand + batch</p>
              <p className="mt-2 text-sm text-pharma-slate-400">Detects medicine identity directly from the strip image.</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Pipeline coverage</p>
              <p className="mt-3 text-xl font-semibold text-white">Five stages</p>
              <p className="mt-2 text-sm text-pharma-slate-400">Identity, OCR, and ledger verification in one run.</p>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08 }}
          className="glass-card overflow-hidden"
        >
          <div className="flex flex-col gap-4 border-b border-white/6 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Capture source</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Acquisition workspace</h3>
              <p className="mt-1 max-w-xl text-sm text-pharma-slate-400">
                Use live capture or upload an inspection image for analysis.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-2xl border border-white/10 bg-pharma-slate-800/80 p-1">
                <button
                  type="button"
                  onClick={() => switchMode(true)}
                  className={`inline-flex items-center rounded-[0.9rem] px-4 py-2 text-sm transition ${
                    useWebcam
                      ? 'bg-cyan-500/15 text-cyan-300 shadow-lg shadow-cyan-500/10'
                      : 'text-pharma-slate-400 hover:text-white'
                  }`}
                >
                  Camera
                </button>
                <button
                  type="button"
                  onClick={() => switchMode(false)}
                  className={`inline-flex items-center rounded-[0.9rem] px-4 py-2 text-sm transition ${
                    !useWebcam
                      ? 'bg-cyan-500/15 text-cyan-300 shadow-lg shadow-cyan-500/10'
                      : 'text-pharma-slate-400 hover:text-white'
                  }`}
                >
                  Upload
                </button>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-mono uppercase tracking-[0.22em] text-pharma-slate-500">
                <span className={`h-2 w-2 rounded-full ${useWebcam ? (webcamReady ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-cyan-400'}`} />
                <span>
                  {useWebcam ? (webcamReady ? 'Camera ready' : 'Preparing camera') : 'Upload mode'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-pharma-slate-800/80 shadow-inner shadow-black/20">
              <div className="relative aspect-[4/5] sm:aspect-[4/3] lg:aspect-[16/11] xl:aspect-[16/10]">
                <AnimatePresence mode="wait">
                  {capturedImage ? (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0"
                    >
                      <img
                        src={capturedImage}
                        alt="Captured medicine strip"
                        className="h-full w-full object-contain bg-pharma-slate-900"
                      />
                      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-pharma-slate-900/80 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-300 backdrop-blur">
                        Review frame
                      </div>
                      <ScanOverlay isActive={isScanning} />
                    </motion.div>
                  ) : useWebcam ? (
                    <motion.div
                      key="webcam"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0"
                    >
                      <Webcam
                        ref={webcamRef}
                        audio={false}
                        mirrored={false}
                        screenshotFormat="image/jpeg"
                        screenshotQuality={0.92}
                        videoConstraints={webcamConfig}
                        onUserMedia={() => setWebcamReady(true)}
                        onUserMediaError={() => {
                          setUseWebcam(false);
                          setWebcamReady(false);
                          setError('Camera not available. Use file upload instead.');
                        }}
                        className="h-full w-full object-cover"
                      />

                      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-pharma-slate-900/80 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-cyan-300 backdrop-blur">
                        Live camera
                      </div>

                      {webcamReady && (
                        <>
                          <div className="scanner-corner top-left" />
                          <div className="scanner-corner top-right" />
                          <div className="scanner-corner bottom-left" />
                          <div className="scanner-corner bottom-right" />
                        </>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="upload"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center p-5 sm:p-8"
                    >
                      <button
                        type="button"
                        onClick={openFilePicker}
                        className="group flex h-full w-full max-w-xl flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center transition hover:border-cyan-400/30 hover:bg-white/[0.04]"
                      >
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 transition group-hover:scale-105">
                          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V4.5m0 0l-4.5 4.5M12 4.5l4.5 4.5M4.5 16.5v1.5A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-1.5" />
                          </svg>
                        </div>
                        <p className="mt-5 text-base font-semibold text-white">Upload a medicine strip image</p>
                        <p className="mt-2 max-w-md text-sm leading-6 text-pharma-slate-400">
                          Use a stored gallery image, inspection photo, or exported frame when live capture is not practical.
                        </p>
                        <span className="mt-5 inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                          Select file
                        </span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Frame guidance</p>
                <p className="mt-3 text-sm leading-6 text-pharma-slate-400">
                  {capturedImage
                    ? 'Review the captured frame and retake if the branding, batch marks, or foil text are cropped.'
                    : 'Keep the medicine strip centered, flat, and glare free so the pipeline receives a reliable reference image.'}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Quick actions</p>
                <div className="mt-3 flex flex-col gap-3">
                  <div className="grid gap-3">
                    <div>
                      <label className="mb-2 block text-xs font-mono uppercase tracking-[0.22em] text-pharma-slate-500">
                        Detected Brand
                      </label>
                      <input
                        type="text"
                        value={isScanning ? EXTRACTING_COPY : detectedBrand}
                        readOnly
                        disabled
                        className="w-full rounded-2xl border border-white/10 bg-pharma-slate-800 px-4 py-3 text-sm text-white outline-none transition disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-mono uppercase tracking-[0.22em] text-pharma-slate-500">
                        Detected Batch
                      </label>
                      <input
                        type="text"
                        value={isScanning ? EXTRACTING_COPY : detectedBatch}
                        readOnly
                        disabled
                        className="w-full rounded-2xl border border-white/10 bg-pharma-slate-800 px-4 py-3 text-sm text-white outline-none transition disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {!capturedImage && useWebcam && (
                    <button
                      type="button"
                      onClick={captureImage}
                      disabled={!webcamReady || isScanning}
                      className="btn-primary inline-flex w-full items-center justify-center gap-2"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.75A2.25 2.25 0 016 7.5h1.54a1.5 1.5 0 001.2-.6l.52-.7a1.5 1.5 0 011.2-.6h2.08a1.5 1.5 0 011.2.6l.52.7a1.5 1.5 0 001.2.6H18a2.25 2.25 0 012.25 2.25v6.75A2.25 2.25 0 0118 18.75H6a2.25 2.25 0 01-2.25-2.25v-6.75z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.125a3 3 0 106 0 3 3 0 00-6 0z" />
                      </svg>
                      Capture strip
                    </button>
                  )}

                  {!capturedImage && !useWebcam && (
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className="btn-primary inline-flex w-full items-center justify-center gap-2"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V4.5m0 0l-4.5 4.5M12 4.5l4.5 4.5M4.5 16.5v1.5A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-1.5" />
                      </svg>
                      Choose image
                    </button>
                  )}

                  {capturedImage && !isScanning && (
                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={handleAnalyze}
                        className="btn-primary inline-flex w-full items-center justify-center gap-2"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.283-3.282L2.058 11.81l2.846-.813a4.5 4.5 0 003.283-3.283L9 4.869l.813 2.845a4.5 4.5 0 003.282 3.283l2.846.813-2.846.813a4.5 4.5 0 00-3.282 3.282zM18.25 8.25L18 9l-.25-.75A2.25 2.25 0 0016.5 7l.75-.25.25-.75.25.75.75.25-1.25.25-.25 1zM16.5 20.25l-.25-.75-.75-.25.75-.25.25-.75.25.75.75.25-.75.25-.25.75z" />
                        </svg>
                        Analyze medicine
                      </button>

                      <button
                        type="button"
                        onClick={handleRetake}
                        className="btn-secondary inline-flex w-full items-center justify-center"
                      >
                        Use another frame
                      </button>
                    </div>
                  )}

                  {isScanning && (
                    <div className="rounded-[1.25rem] border border-cyan-400/20 bg-cyan-500/10 p-4">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="h-4 w-4 rounded-full border-2 border-cyan-300 border-t-transparent"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                        <div>
                          <p className="text-sm font-semibold text-cyan-300">Processing the scan</p>
                          <p className="text-xs text-pharma-slate-400">Vision, OCR, and ledger checks are running.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12 }}
          className="space-y-4"
        >
          <section className="glass-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">AI-first workflow</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Zero-click verification</h3>
              </div>
              <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-pharma-slate-500">
                Image only
              </span>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm leading-6 text-pharma-slate-400">
                The scanner now submits only the strip image. The backend extracts brand, batch, and
                compounds through Gemini OCR, then cross-checks the result against the MongoDB Truth Ledger.
              </p>
            </div>
          </section>

          <AnimatePresence>
            {error && (
              <motion.section
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-[1.5rem] border border-red-500/30 bg-red-500/10 p-4"
              >
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-red-300">Attention needed</p>
                <p className="mt-2 text-sm leading-6 text-red-200">{error}</p>
              </motion.section>
            )}
          </AnimatePresence>

          <section id="scanner-workflow" className="section-anchor glass-card p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Pipeline</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Pipeline stages</h3>
              </div>
              <p className="text-sm text-pharma-slate-400">Five connected checks across identity, OCR, and ledger validation.</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {PIPELINE_STAGES.map((stage) => (
                <div key={stage.step} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">
                      Step {stage.step}
                    </span>
                    <span className="rounded-full border border-white/10 bg-pharma-slate-800 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-pharma-slate-400">
                      {stage.tag}
                    </span>
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-white">{stage.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-pharma-slate-400">{stage.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="scanner-tips" className="section-anchor glass-card p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Capture guidance</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Acquisition standards</h3>

            <div className="mt-4 space-y-3">
              {CAPTURE_TIPS.map((tip) => (
                <div key={tip} className="flex items-start gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                  <p className="text-sm leading-6 text-pharma-slate-400">{tip}</p>
                </div>
              ))}
            </div>
          </section>
        </motion.aside>
      </div>
    </div>
  );
}
