import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';

const HISTORY_ENDPOINT = '/api/history?verdict=COUNTERFEIT&limit=250';
const REFRESH_INTERVAL_MS = 20000;
const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM = 4;

function hasValidCoordinates(scan) {
  const latitude = Number(scan?.latitude);
  const longitude = Number(scan?.longitude);

  return (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
  );
}

function formatTimestamp(value) {
  if (!value) {
    return 'Timestamp unavailable';
  }

  return new Date(value).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ThreatViewportController({ scans }) {
  const map = useMap();

  useEffect(() => {
    if (!scans.length) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    map.fitBounds(
      scans.map((scan) => [scan.latitude, scan.longitude]),
      {
        padding: [36, 36],
        maxZoom: 8,
      },
    );
  }, [map, scans]);

  return null;
}

export default function ThreatMap() {
  const [scans, setScans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let isActive = true;
    let intervalId = null;
    let activeController = null;

    const loadThreats = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        const response = await fetch(HISTORY_ENDPOINT, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Threat feed request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const nextScans = Array.isArray(payload.scans)
          ? payload.scans
              .filter(hasValidCoordinates)
              .map((scan) => ({
                ...scan,
                latitude: Number(scan.latitude),
                longitude: Number(scan.longitude),
              }))
          : [];

        if (!isActive) {
          return;
        }

        setScans(nextScans);
        setError(null);
        setLastUpdated(new Date());
      } catch (fetchError) {
        if (fetchError.name === 'AbortError' || !isActive) {
          return;
        }

        console.error('Threat radar fetch failed:', fetchError);
        setError(fetchError.message || 'Unable to load the counterfeit threat feed.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadThreats();
    intervalId = window.setInterval(loadThreats, REFRESH_INTERVAL_MS);

    return () => {
      isActive = false;

      if (intervalId) {
        window.clearInterval(intervalId);
      }

      activeController?.abort();
    };
  }, []);

  const uniqueBatchCount = new Set(
    scans
      .map((scan) => scan.batchNumber)
      .filter(Boolean),
  ).size;

  const latestIntercept = scans[0];

  return (
    <motion.section
      id="god-view-radar"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="section-anchor threat-radar-widget glass-card overflow-hidden"
    >
      <style>
        {`
          .threat-radar-widget .leaflet-container {
            height: 100%;
            width: 100%;
            background: #020617;
            font-family: inherit;
          }

          .threat-radar-widget .leaflet-control-zoom {
            border: 1px solid rgba(148, 163, 184, 0.18);
            box-shadow: 0 10px 25px rgba(2, 6, 23, 0.45);
          }

          .threat-radar-widget .leaflet-control-zoom a {
            background: rgba(15, 23, 42, 0.94);
            color: #e2e8f0;
            border-bottom-color: rgba(148, 163, 184, 0.14);
          }

          .threat-radar-widget .leaflet-control-zoom a:hover {
            background: rgba(30, 41, 59, 0.98);
            color: #f8fafc;
          }

          .threat-radar-widget .leaflet-popup-content-wrapper,
          .threat-radar-widget .leaflet-popup-tip {
            background: rgba(2, 6, 23, 0.96);
            color: #e2e8f0;
            border: 1px solid rgba(248, 113, 113, 0.22);
            box-shadow: 0 22px 45px rgba(2, 6, 23, 0.55);
          }

          .threat-radar-widget .leaflet-popup-content {
            margin: 0;
          }

          .threat-radar-widget .leaflet-popup-close-button {
            color: #94a3b8;
          }

          .threat-radar-widget .leaflet-popup-close-button:hover {
            color: #f8fafc;
          }

          .threat-radar-widget .threat-pulse-marker {
            animation: threatPulse 1.8s ease-out infinite;
            filter:
              drop-shadow(0 0 6px rgba(248, 113, 113, 0.95))
              drop-shadow(0 0 18px rgba(239, 68, 68, 0.72));
          }

          @keyframes threatPulse {
            0% {
              stroke-width: 2px;
              fill-opacity: 0.92;
            }

            50% {
              stroke-width: 7px;
              fill-opacity: 0.42;
            }

            100% {
              stroke-width: 2px;
              fill-opacity: 0.92;
            }
          }
        `}
      </style>

      <div className="border-b border-white/6 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.26em] text-red-300">
              God View
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Counterfeit threat radar
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-pharma-slate-400 sm:text-base">
              Live geospatial intelligence for counterfeit intercepts captured by the OptiPharma scan pipeline.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[440px]">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Intercepts</p>
              <p className="mt-3 text-3xl font-semibold text-red-300">{scans.length}</p>
              <p className="mt-2 text-sm text-pharma-slate-400">Active counterfeit scans with coordinates.</p>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Batches flagged</p>
              <p className="mt-3 text-3xl font-semibold text-white">{uniqueBatchCount}</p>
              <p className="mt-2 text-sm text-pharma-slate-400">Distinct counterfeit batches currently plotted.</p>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">Feed status</p>
                <span className={`status-dot ${error ? 'bg-red-400 shadow-lg shadow-red-500/40' : 'online'}`} />
              </div>
              <p className="mt-3 text-base font-semibold text-white">
                {lastUpdated ? formatTimestamp(lastUpdated) : 'Awaiting first sync'}
              </p>
              <p className="mt-2 text-sm text-pharma-slate-400">
                Refresh cadence: {(REFRESH_INTERVAL_MS / 1000).toFixed(0)} seconds.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative h-[28rem] overflow-hidden bg-pharma-slate-950 sm:h-[32rem]">
        <div className="pointer-events-none absolute inset-0 z-[390] bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.18),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(34,211,238,0.12),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,0.22)_100%)]" />
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 z-[400] h-24 bg-gradient-to-b from-red-500/18 via-red-500/0 to-transparent"
          animate={{ y: ['-18%', '92%', '-18%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        />

        <div className="absolute left-4 top-4 z-[410] rounded-2xl border border-cyan-400/20 bg-slate-950/80 px-4 py-3 backdrop-blur-xl">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-cyan-300">Latest intercept</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {latestIntercept?.brandName || 'No geotagged counterfeit scans yet'}
          </p>
          <p className="mt-1 text-xs text-pharma-slate-400">
            {latestIntercept
              ? `${latestIntercept.batchNumber || 'Batch unknown'} | ${formatTimestamp(latestIntercept.scannedAt)}`
              : 'Waiting for incoming coordinates from the scanner.'}
          </p>
        </div>

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <ThreatViewportController scans={scans} />

          {scans.map((scan) => (
            <CircleMarker
              key={scan._id || `${scan.batchNumber}-${scan.scannedAt}-${scan.latitude}-${scan.longitude}`}
              center={[scan.latitude, scan.longitude]}
              radius={8}
              pathOptions={{
                color: '#fda4af',
                fillColor: '#ef4444',
                fillOpacity: 0.84,
                weight: 2,
                className: 'threat-pulse-marker',
              }}
            >
              <Popup className="threat-popup">
                <div className="min-w-[16rem] space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-red-300">
                      Counterfeit
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-pharma-slate-500">
                      {scan.verdict}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-pharma-slate-500">Brand</p>
                      <p className="mt-1 text-sm font-semibold text-white">{scan.brandName || 'Unknown brand'}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-pharma-slate-500">Batch</p>
                      <p className="mt-1 text-sm font-semibold text-white">{scan.batchNumber || 'UNKNOWN'}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-pharma-slate-500">Scanned at</p>
                      <p className="mt-1 text-sm text-pharma-slate-300">{formatTimestamp(scan.scannedAt)}</p>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-[420] flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px]">
            <div className="rounded-[1.5rem] border border-cyan-400/20 bg-slate-950/90 px-5 py-4 text-center shadow-2xl shadow-black/35">
              <div className="mx-auto h-4 w-4 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin" />
              <p className="mt-3 text-sm font-semibold text-cyan-300">Synchronizing threat feed</p>
              <p className="mt-1 text-xs text-pharma-slate-400">Pulling counterfeit intercepts from `/api/history`.</p>
            </div>
          </div>
        )}

        {!isLoading && !error && !scans.length && (
          <div className="pointer-events-none absolute inset-0 z-[420] flex items-center justify-center px-6">
            <div className="max-w-md rounded-[1.5rem] border border-white/10 bg-slate-950/82 p-5 text-center backdrop-blur-xl">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-pharma-slate-500">No signals yet</p>
              <p className="mt-3 text-lg font-semibold text-white">No counterfeit scans with location data are available.</p>
              <p className="mt-2 text-sm leading-6 text-pharma-slate-400">
                Once operators allow geolocation and a counterfeit verdict is logged, the intercept will appear here automatically.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[420] rounded-[1.35rem] border border-red-400/30 bg-red-500/10 px-4 py-3 shadow-xl shadow-black/25 backdrop-blur-xl">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-red-300">Threat feed degraded</p>
            <p className="mt-2 text-sm text-red-100">{error}</p>
          </div>
        )}
      </div>
    </motion.section>
  );
}
