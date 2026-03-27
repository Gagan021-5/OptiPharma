/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  OptiPharma — Scanner Component                                     ║
 * ║                                                                     ║
 * ║  The primary interaction component. Features:                       ║
 * ║  • Live webcam feed with react-webcam                               ║
 * ║  • Animated scanning overlay (ScanOverlay)                          ║
 * ║  • File upload fallback for gallery images                          ║
 * ║  • Batch number input for MongoDB Truth Ledger lookup               ║
 * ║  • Sends captured image to Node.js gateway → Python pipeline        ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import ScanOverlay from './ScanOverlay';

// API endpoint — proxied via Vite to Node gateway
const API_URL = '/api/scan';

export default function Scanner({ onScanComplete, isScanning, setIsScanning }) {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [capturedImage, setCapturedImage] = useState(null);
  const [batchNumber, setBatchNumber] = useState('');
  const [error, setError] = useState(null);
  const [useWebcam, setUseWebcam] = useState(true);
  const [webcamReady, setWebcamReady] = useState(false);

  // Webcam configuration — optimized for medicine strip scanning
  const webcamConfig = {
    width: 640,
    height: 480,
    facingMode: { ideal: 'environment' }, // Rear camera on mobile
  };

  // ─── Capture from Webcam ───────────────────────────────────
  const captureImage = useCallback(() => {
    if (!webcamRef.current) return;
    
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setError(null);
    }
  }, []);

  // ─── Handle File Upload ────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImage(event.target.result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // ─── Convert base64 to File for upload ─────────────────────
  const dataURLtoFile = (dataurl, filename = 'capture.jpg') => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  // ─── Submit to Pipeline ────────────────────────────────────
  const handleAnalyze = async () => {
    if (!capturedImage) {
      setError('Please capture or upload an image first');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', dataURLtoFile(capturedImage));
      
      if (batchNumber.trim()) {
        formData.append('batch_number', batchNumber.trim().toUpperCase());
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || `Server error: ${response.status}`);
      }

      const report = await response.json();
      onScanComplete(report);
    } catch (err) {
      console.error('Scan failed:', err);
      setError(err.message || 'Failed to connect to OptiPharma backend');
      setIsScanning(false);
    }
  };

  // ─── Reset captured image ──────────────────────────────────
  const handleRetake = () => {
    setCapturedImage(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* ─── Title Section ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-2xl font-bold text-white">
          Medicine <span className="text-cyan-400">Verification Scanner</span>
        </h2>
        <p className="text-sm text-pharma-slate-500 mt-1 font-mono">
          Position the medicine strip within the scanner frame
        </p>
      </motion.div>

      {/* ─── Scanner Area ───────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left: Camera / Image Preview */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="glass-card overflow-hidden">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2 p-3 border-b border-white/5">
              <button
                onClick={() => { setUseWebcam(true); setCapturedImage(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  useWebcam
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-pharma-slate-500 hover:text-white'
                }`}
              >
                📷 Camera
              </button>
              <button
                onClick={() => { setUseWebcam(false); setCapturedImage(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !useWebcam
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-pharma-slate-500 hover:text-white'
                }`}
              >
                📁 Upload
              </button>
              <div className="flex-1" />
              <span className="text-[10px] font-mono text-pharma-slate-600">
                {useWebcam ? 'LIVE FEED' : 'FILE MODE'}
              </span>
            </div>

            {/* Camera / Preview Area */}
            <div className="relative aspect-[4/3] bg-pharma-slate-800">
              <AnimatePresence mode="wait">
                {capturedImage ? (
                  /* ─── Captured Image Preview ─────────── */
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
                      className="w-full h-full object-contain bg-pharma-slate-900"
                    />
                    {/* Scanning overlay when analyzing */}
                    <ScanOverlay isActive={isScanning} />
                  </motion.div>
                ) : useWebcam ? (
                  /* ─── Live Webcam Feed ───────────────── */
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
                      screenshotFormat="image/jpeg"
                      screenshotQuality={0.92}
                      videoConstraints={webcamConfig}
                      onUserMedia={() => setWebcamReady(true)}
                      onUserMediaError={() => {
                        setUseWebcam(false);
                        setError('Camera not available — use file upload instead');
                      }}
                      className="w-full h-full object-cover"
                    />
                    {/* Static corner brackets for framing */}
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
                  /* ─── File Upload Zone ───────────────── */
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer text-center p-8 border-2 border-dashed border-white/10 rounded-2xl
                                 hover:border-cyan-400/30 hover:bg-white/[0.02] transition-all mx-8"
                    >
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
                        <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <p className="text-sm text-white font-medium">Click to upload medicine strip image</p>
                      <p className="text-xs text-pharma-slate-500 mt-1">JPEG, PNG, WebP — Max 10MB</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Right: Controls Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {/* Batch Number Input */}
          <div className="glass-card p-4">
            <label className="block text-xs font-mono text-pharma-slate-500 uppercase tracking-wider mb-2">
              Batch Number (Optional)
            </label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="e.g., BATCH-PCM-2026-001"
              disabled={isScanning}
              className="w-full px-3 py-2.5 rounded-lg bg-pharma-slate-800 border border-white/10
                         text-white text-sm font-mono placeholder:text-pharma-slate-600
                         focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20
                         transition-all disabled:opacity-50"
            />
            <p className="text-[10px] text-pharma-slate-600 mt-1.5">
              Enables Truth Ledger lookup for compound verification
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {!capturedImage && useWebcam && (
              <button
                onClick={captureImage}
                disabled={!webcamReady || isScanning}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                Capture Strip
              </button>
            )}

            {capturedImage && !isScanning && (
              <>
                <button
                  onClick={handleAnalyze}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611a48.309 48.309 0 01-12.27 0c-1.717-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                  Analyze Medicine
                </button>
                <button
                  onClick={handleRetake}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium
                             text-pharma-slate-500 border border-white/10
                             hover:text-white hover:border-white/20 transition-all"
                >
                  ← Retake / Upload New
                </button>
              </>
            )}

            {isScanning && (
              <div className="glass-card p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <motion.div
                    className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <span className="text-sm font-medium text-cyan-400">Processing...</span>
                </div>
                <div className="text-[10px] font-mono text-pharma-slate-500 space-y-0.5">
                  <p>→ OpenCV preprocessing</p>
                  <p>→ SSIM logo comparison</p>
                  <p>→ Gemini Vision OCR</p>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/30"
              >
                <p className="text-xs text-red-400">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pipeline Info Card */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-mono text-pharma-slate-500 uppercase tracking-wider mb-3">
              Pipeline Stages
            </h3>
            <div className="space-y-2.5">
              {[
                { label: 'Image Preprocessing', desc: 'Gaussian Blur + Edge Detection', icon: '🔬' },
                { label: 'Perspective Warp', desc: 'Strip alignment & correction', icon: '📐' },
                { label: 'SSIM Analysis', desc: 'Logo comparison (95% threshold)', icon: '🛡️' },
                { label: 'Gemini Vision OCR', desc: 'Text & compound extraction', icon: '🤖' },
                { label: 'Truth Ledger Check', desc: 'MongoDB compound verification', icon: '📋' },
              ].map((stage, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5">{stage.icon}</span>
                  <div>
                    <p className="text-xs font-medium text-white/80">{stage.label}</p>
                    <p className="text-[10px] text-pharma-slate-600">{stage.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
