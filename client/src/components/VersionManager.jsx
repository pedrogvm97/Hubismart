import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
  GitBranch,
  DownloadCloud,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Info,
  Check,
  X,
  Clock
} from 'lucide-react';
import { systemApi } from '../api';

const VersionManager = () => {
  const [versionData, setVersionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [updatingTag, setUpdatingTag] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type: 'upgrade'|'downgrade', tag: string }
  const [actionProgress, setActionProgress] = useState(null);
  const [autoUpdate, setAutoUpdate] = useState(false);

  useEffect(() => {
    loadVersionStatus();
  }, []);

  const loadVersionStatus = async () => {
    setLoading(true);
    try {
      const data = await systemApi.getVersionStatus();
      setVersionData(data);
      setAutoUpdate(!!data.autoUpdateEnabled);
    } catch (err) {
      console.error('Failed to load version status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    try {
      const data = await systemApi.checkForUpdates();
      setVersionData(data);
    } catch (err) {
      alert('Failed to check updates: ' + err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleToggleAutoUpdate = async () => {
    const nextVal = !autoUpdate;
    setAutoUpdate(nextVal);
    try {
      await systemApi.updateSettings({ auto_update: nextVal ? 1 : 0 });
    } catch (err) {
      alert('Failed to update setting: ' + err.message);
    }
  };

  const handleExecuteSwitch = async (tag) => {
    setUpdatingTag(tag);
    setActionProgress({
      status: 'pulling',
      message: `Pulling image for ${tag} and applying container update...`
    });

    try {
      const res = await systemApi.applyUpdate(tag);
      if (res.success) {
        setActionProgress({
          status: 'success',
          message: res.message || `Switched to ${tag}! Container is restarting now.`
        });
        // Automatically reload page after 8 seconds
        setTimeout(() => {
          window.location.reload();
        }, 8000);
      } else {
        setActionProgress({
          status: 'manual',
          message: res.message || 'Manual execution required on Unraid.',
          command: res.command
        });
      }
    } catch (err) {
      setActionProgress({
        status: 'error',
        message: err.message || 'Version switch failed'
      });
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto pb-20">
      {/* Top Header Card with Logo and Live Status */}
      <div className="flex flex-wrap items-center justify-between gap-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="relative p-2 bg-slate-950/60 border border-white/10 rounded-3xl shadow-xl flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Hubismart Logo"
              className="w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]"
              onError={(e) => {
                e.target.src = '/logo.svg';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-extrabold text-white tracking-wide">
                Hubismart Version Manager
              </h2>
              <span className="px-4 py-1.5 bg-indigo-600/30 text-indigo-300 font-mono font-bold text-xl rounded-xl border border-indigo-500/30">
                {versionData?.currentVersion || 'v1.0.3'}
              </span>
            </div>
            <p className="text-slate-400 text-lg mt-1 font-medium">
              Automated updater, version rollbacks, and release changelogs from GitHub.
            </p>
          </div>
        </div>

        {/* Global Action Icons (Strict Symbols Over Text Rule) */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheckUpdates}
            disabled={checking}
            className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all duration-200 shadow-md active:scale-95 disabled:opacity-50"
            title="Check GitHub for New Releases & Updates"
          >
            <RefreshCw size={28} className={checking ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Version Status & Settings Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="lg:col-span-2 p-7 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-xl flex flex-col justify-between gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">System State</span>
              <div className="flex items-center gap-3 mt-1">
                {versionData?.updateAvailable ? (
                  <>
                    <ArrowUpCircle size={32} className="text-amber-400" />
                    <h3 className="text-2xl font-bold text-white">
                      Update Available: <span className="text-amber-400 font-mono">{versionData.latestVersion}</span>
                    </h3>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={32} className="text-emerald-400" />
                    <h3 className="text-2xl font-bold text-white">
                      Hubismart is Up to Date
                    </h3>
                  </>
                )}
              </div>
            </div>

            {versionData?.updateAvailable && (
              <button
                onClick={() => setActionModal({ type: 'upgrade', tag: versionData.latestVersion })}
                className="p-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-amber-500/20 transition-all active:scale-95"
                title={`One-Click Update to ${versionData.latestVersion}`}
              >
                <DownloadCloud size={28} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10 text-slate-300 text-lg">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-slate-400" />
              <span>Last Checked: {versionData?.lastChecked ? new Date(versionData.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-400">Docker Engine Socket:</span>
              <span className={`px-3 py-1 rounded-xl text-sm font-bold border ${
                versionData?.hasDockerSocket
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-600/20 text-amber-300 border-amber-500/30'
              }`}>
                {versionData?.hasDockerSocket ? 'Active' : 'Unmounted'}
              </span>
            </div>
          </div>
        </div>

        {/* Auto-Updater Policy Card */}
        <div className="p-7 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-xl flex flex-col justify-between gap-4">
          <div>
            <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">Automation</span>
            <h3 className="text-2xl font-bold text-white mt-1">Automatic Updates</h3>
            <p className="text-slate-400 text-base mt-2">
              Automatically pull and restart container when a new stable release is published on GitHub.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <span className="text-lg font-medium text-slate-300">
              {autoUpdate ? 'Enabled' : 'Manual Approval Only'}
            </span>
            <button
              onClick={handleToggleAutoUpdate}
              className={`p-3.5 rounded-2xl border transition-all active:scale-95 ${
                autoUpdate
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white border-white/10'
              }`}
              title={autoUpdate ? 'Disable Automatic Updates' : 'Enable Automatic Updates'}
            >
              {autoUpdate ? <Check size={26} /> : <X size={26} />}
            </button>
          </div>
        </div>
      </div>

      {/* Unraid Template & WebUI Integration Notes */}
      <div className="p-6 bg-slate-900/40 border border-white/10 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-slate-300 text-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
            <Info size={26} />
          </div>
          <div>
            <p className="text-white font-bold">Unraid WebUI & Icon Link Configuration</p>
            <p className="text-slate-400 text-base">
              Configured with explicit <code className="text-indigo-300 font-mono bg-white/5 px-2 py-0.5 rounded">http://[IP]:3020/</code> and transparent <code className="text-indigo-300 font-mono bg-white/5 px-2 py-0.5 rounded">logo.png</code> in Unraid Docker manager.
            </p>
          </div>
        </div>
      </div>

      {/* Releases & Downdater History Section */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch size={28} className="text-indigo-400" />
            <h3 className="text-2xl font-bold text-white">GitHub Releases & Version Downdater</h3>
          </div>
          <span className="text-slate-400 text-lg font-mono">
            {versionData?.releases?.length || 0} Versions Available
          </span>
        </div>

        {versionData?.releases && versionData.releases.length > 0 ? (
          <div className="flex flex-col gap-5">
            {versionData.releases.map((rel) => (
              <div
                key={rel.id}
                className={`p-7 rounded-3xl border transition-all duration-200 ${
                  rel.isCurrent
                    ? 'bg-slate-900/90 border-indigo-500 shadow-xl shadow-indigo-600/10'
                    : 'bg-slate-900/50 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-4">
                      <h4 className="text-2xl font-black text-white font-mono">{rel.tag}</h4>
                      {rel.isCurrent && (
                        <span className="px-3.5 py-1 bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-sm font-bold">
                          Current Running
                        </span>
                      )}
                      {rel.isLatest && !rel.isCurrent && (
                        <span className="px-3.5 py-1 bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-sm font-bold">
                          Latest Release
                        </span>
                      )}
                      {rel.isDowngrade && (
                        <span className="px-3.5 py-1 bg-slate-800 text-slate-400 border border-white/10 rounded-xl text-sm font-bold">
                          Rollback Candidate
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-base mt-1">
                      Released on {formatDate(rel.publishedAt)}
                    </p>
                  </div>

                  {/* Action Icons (Strict Symbols Over Text Rule) */}
                  <div className="flex items-center gap-3">
                    <a
                      href={rel.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-95"
                      title="View Release on GitHub"
                    >
                      <ExternalLink size={24} />
                    </a>

                    {rel.isUpgrade && (
                      <button
                        onClick={() => setActionModal({ type: 'upgrade', tag: rel.tag })}
                        className="p-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                        title={`Update to ${rel.tag}`}
                      >
                        <ArrowUpCircle size={26} />
                      </button>
                    )}

                    {rel.isDowngrade && (
                      <button
                        onClick={() => setActionModal({ type: 'downgrade', tag: rel.tag })}
                        className="p-3.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-2xl border border-amber-500/30 transition-all active:scale-95"
                        title={`Downgrade (Roll back) to ${rel.tag}`}
                      >
                        <ArrowDownCircle size={26} />
                      </button>
                    )}

                    {rel.isCurrent && (
                      <div className="p-3.5 bg-emerald-600/20 text-emerald-400 rounded-2xl border border-emerald-500/20" title="Active Version">
                        <CheckCircle2 size={26} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Release Notes / Markdown Preview */}
                <div className="p-5 bg-black/40 rounded-2xl border border-white/5 text-slate-300 text-lg leading-relaxed whitespace-pre-wrap font-sans">
                  {rel.notes}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 bg-slate-900/40 border border-white/10 rounded-3xl text-center">
            <RefreshCw size={48} className="text-slate-600 mb-3 animate-spin mx-auto" />
            <h4 className="text-2xl font-bold text-white mb-1">Loading GitHub Releases...</h4>
            <p className="text-slate-400 text-lg">Fetching tags and release notes from GitHub</p>
          </div>
        )}
      </div>

      {/* Confirmation & Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-950 border border-white/20 rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-4">
                {actionModal.type === 'upgrade' ? (
                  <div className="p-3.5 bg-indigo-600 rounded-2xl text-white">
                    <ArrowUpCircle size={32} />
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-600 rounded-2xl text-white">
                    <ArrowDownCircle size={32} />
                  </div>
                )}
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {actionModal.type === 'upgrade' ? 'Confirm Update' : 'Confirm Version Rollback (Downgrade)'}
                  </h3>
                  <p className="text-slate-400 text-lg font-mono">Target: {actionModal.tag}</p>
                </div>
              </div>
              {!actionProgress && (
                <button
                  onClick={() => {
                    setActionModal(null);
                    setActionProgress(null);
                  }}
                  className="p-3 text-slate-400 hover:text-white"
                  title="Close Modal"
                >
                  <X size={26} />
                </button>
              )}
            </div>

            {!actionProgress ? (
              <div className="space-y-4">
                <p className="text-slate-300 text-xl leading-relaxed">
                  Are you sure you want to {actionModal.type === 'upgrade' ? 'update' : 'roll back (downgrade)'} Hubismart to version <strong className="text-white font-mono">{actionModal.tag}</strong>?
                </p>
                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl text-base text-slate-400 space-y-2">
                  <p>• The container image will be pulled from GitHub Container Registry.</p>
                  <p>• Your recordings and camera database configurations remain intact.</p>
                  <p>• The WebUI will automatically reconnect after container restart.</p>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-white/10">
                  <button
                    onClick={() => setActionModal(null)}
                    className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xl rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleExecuteSwitch(actionModal.tag)}
                    className={`px-8 py-4 font-bold text-xl rounded-2xl shadow-xl transition-all active:scale-95 ${
                      actionModal.type === 'upgrade'
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                    }`}
                  >
                    {actionModal.type === 'upgrade' ? 'Proceed with Update' : 'Proceed with Downgrade'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-center py-4">
                {actionProgress.status === 'pulling' && (
                  <div className="flex flex-col items-center gap-4">
                    <RefreshCw size={56} className="text-indigo-400 animate-spin" />
                    <h4 className="text-2xl font-bold text-white">Applying Version Switch...</h4>
                    <p className="text-slate-400 text-lg">{actionProgress.message}</p>
                  </div>
                )}

                {actionProgress.status === 'success' && (
                  <div className="flex flex-col items-center gap-4">
                    <CheckCircle2 size={56} className="text-emerald-400" />
                    <h4 className="text-2xl font-bold text-white">Success!</h4>
                    <p className="text-slate-300 text-lg">{actionProgress.message}</p>
                    <p className="text-indigo-400 text-sm animate-pulse">Reconnecting to WebUI...</p>
                  </div>
                )}

                {actionProgress.status === 'manual' && (
                  <div className="flex flex-col items-start text-left gap-4">
                    <AlertTriangle size={48} className="text-amber-400 mx-auto" />
                    <h4 className="text-2xl font-bold text-white">Manual Command for Unraid</h4>
                    <p className="text-slate-300 text-lg">{actionProgress.message}</p>
                    <pre className="w-full p-4 bg-slate-900 border border-white/10 rounded-2xl text-emerald-400 font-mono text-sm overflow-x-auto whitespace-pre-wrap select-all">
                      {actionProgress.command}
                    </pre>
                    <button
                      onClick={() => {
                        setActionModal(null);
                        setActionProgress(null);
                      }}
                      className="w-full py-4 bg-slate-800 text-white font-bold text-lg rounded-2xl"
                    >
                      Close
                    </button>
                  </div>
                )}

                {actionProgress.status === 'error' && (
                  <div className="flex flex-col items-center gap-4">
                    <AlertTriangle size={56} className="text-rose-400" />
                    <h4 className="text-2xl font-bold text-white">Version Switch Failed</h4>
                    <p className="text-rose-300 text-lg">{actionProgress.message}</p>
                    <button
                      onClick={() => {
                        setActionModal(null);
                        setActionProgress(null);
                      }}
                      className="px-6 py-3 bg-slate-800 text-white rounded-xl"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionManager;
