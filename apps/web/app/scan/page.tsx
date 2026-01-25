'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Download,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  Building2,
  Globe,
  Lightbulb,
  Zap,
  Tag,
  BarChart3,
  Megaphone,
  MessageSquare,
  FlaskConical,
  Bug,
  Server,
  Info,
  Wand2,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { FixModal } from '@/components/scan/fix-modal';
import type { ScanResult, ScriptInfo, DynamicLoaderInfo } from '@/lib/scanner';

const loaderTypeIcons: Record<DynamicLoaderInfo['type'], React.ElementType> = {
  tag_manager: Tag,
  analytics: BarChart3,
  advertising: Megaphone,
  widget: MessageSquare,
  a_b_testing: FlaskConical,
  error_tracking: Bug,
  cdn: Server,
};

const loaderTypeColors: Record<DynamicLoaderInfo['type'], string> = {
  tag_manager: 'text-red-400 bg-red-500/10 border-red-500/30',
  analytics: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  advertising: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  widget: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  a_b_testing: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  error_tracking: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  cdn: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
};

const riskColors = {
  critical: 'text-red-500 bg-red-500/10 border-red-500/30',
  high: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  medium: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  low: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  safe: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
};

const riskIcons = {
  critical: ShieldX,
  high: ShieldAlert,
  medium: AlertTriangle,
  low: Shield,
  safe: ShieldCheck,
};

function RiskBadge({ level }: { level: ScriptInfo['riskLevel'] }) {
  const Icon = riskIcons[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${riskColors[level]}`}
    >
      <Icon className="w-3 h-3" />
      {level.toUpperCase()}
    </span>
  );
}

function ScriptCard({ script }: { script: ScriptInfo }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(script.src);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (script.isInline) {
    return (
      <div className="feature-card">
        <div className="flex items-start justify-between gap-4 mb-2">
          <span className="text-sm text-zinc-500 font-mono">Inline Script</span>
          <RiskBadge level={script.riskLevel} />
        </div>
        <p className="text-sm text-zinc-400">{script.riskReason}</p>
      </div>
    );
  }

  return (
    <div className="feature-card">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-zinc-200 truncate">
              {script.domain}
            </span>
            {script.isFirstParty ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Building2 className="w-2.5 h-2.5" />
                1st party
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-700/50 text-zinc-400 border border-zinc-600/30">
                <Globe className="w-2.5 h-2.5" />
                3rd party
              </span>
            )}
            <a
              href={script.src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <code className="text-xs text-zinc-500 truncate block max-w-[200px] sm:max-w-md">
              {script.src}
            </code>
            <button
              onClick={handleCopy}
              className="text-zinc-500 hover:text-zinc-300"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
        <RiskBadge level={script.riskLevel} />
      </div>
      <p className="text-sm text-zinc-400 mb-2">{script.riskReason}</p>
      {script.hasIntegrity && (
        <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs font-mono text-zinc-500 truncate">
          integrity="{script.integrity}"
        </div>
      )}
    </div>
  );
}

export default function ScanPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showFixModal, setShowFixModal] = useState(false);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan URL');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const externalScripts = result?.scripts.filter((s) => s.isExternal) || [];
  const vulnerableCount = externalScripts.filter(
    (s) => s.riskLevel === 'critical' || s.riskLevel === 'high'
  ).length;
  // Only count third-party scripts without SRI (first-party is lower priority)
  const scriptsNeedingSRI = externalScripts.filter(
    (s) => !s.hasIntegrity && s.src && !s.isFirstParty
  ).length;

  return (
    <main className="min-h-screen bg-[rgb(var(--background))]">
      <Navbar />

      <div className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
              <Search className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Polyfill Scanner</h1>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Scan any website for vulnerable external scripts. Detect missing SRI,
              compromised CDNs, and supply chain risks.
            </p>
          </motion.div>

          {/* URL Input */}
          <motion.form
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleScan}
            className="mb-12"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter URL to scan (e.g., https://example.com)"
                className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50"
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                Scan
              </button>
            </div>
          </motion.form>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400"
            >
              {error}
            </motion.div>
          )}

          {/* Results */}
          {result && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              {/* Summary */}
              <div className="glass rounded-xl p-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Scan Results</h2>
                    <p className="text-sm text-zinc-500 truncate max-w-md">
                      {result.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <RiskBadge level={result.overallRisk} />
                    {scriptsNeedingSRI > 0 && (
                      <button
                        onClick={() => setShowFixModal(true)}
                        className="btn-primary text-sm py-2"
                      >
                        <Wand2 className="w-4 h-4" />
                        Fix {scriptsNeedingSRI} Scripts
                      </button>
                    )}
                    <button
                      onClick={handleExportJSON}
                      className="btn-secondary text-sm py-2"
                    >
                      <Download className="w-4 h-4" />
                      Export JSON
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="p-4 bg-zinc-800/50 rounded-lg">
                    <div className="text-2xl font-bold">{result.totalScripts}</div>
                    <div className="text-sm text-zinc-500">Total Scripts</div>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-400">{result.firstPartyScripts}</div>
                    <div className="text-sm text-zinc-500">First-Party</div>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded-lg">
                    <div className="text-2xl font-bold">{result.thirdPartyScripts}</div>
                    <div className="text-sm text-zinc-500">Third-Party</div>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded-lg">
                    <div className="text-2xl font-bold">{result.inlineScripts}</div>
                    <div className="text-sm text-zinc-500">Inline</div>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded-lg">
                    <div className={`text-2xl font-bold ${vulnerableCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {vulnerableCount}
                    </div>
                    <div className="text-sm text-zinc-500">Vulnerable</div>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded-lg">
                    <div className={`text-2xl font-bold ${(result.dynamicLoaders?.length || 0) > 0 ? 'text-purple-400' : 'text-zinc-500'}`}>
                      {result.dynamicLoaders?.length || 0}
                    </div>
                    <div className="text-sm text-zinc-500">Dyn. Loaders</div>
                  </div>
                </div>

                {/* Scan info */}
                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-start gap-2 text-xs text-zinc-500">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    This scan analyzes the initial HTML response. Scripts loaded dynamically via
                    JavaScript (e.g., through tag managers) are detected but their sub-dependencies
                    are not visible. For a complete audit, review your tag manager configuration.
                  </span>
                </div>
              </div>

              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="text-lg font-semibold text-amber-400">Important Warnings</h3>
                  </div>
                  <ul className="space-y-3">
                    {result.warnings.map((warning, i) => (
                      <li key={i} className="text-sm text-amber-200/90">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Dynamic Loaders Detected */}
              {result.dynamicLoaders && result.dynamicLoaders.length > 0 && (
                <div className="glass rounded-xl p-6 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-purple-500" />
                    <h3 className="text-lg font-semibold">Dynamic Script Loaders</h3>
                    <span className="text-xs text-zinc-500 ml-2">
                      ({result.dynamicLoaders.length} detected)
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">
                    These services can dynamically load additional scripts after page load.
                    Scripts loaded this way are not visible in the initial HTML scan.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {result.dynamicLoaders.map((loader, i) => {
                      const Icon = loaderTypeIcons[loader.type];
                      const colorClass = loaderTypeColors[loader.type];
                      return (
                        <div
                          key={i}
                          className={`p-4 rounded-lg border ${colorClass}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="w-4 h-4" />
                            <span className="font-medium">{loader.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                loader.risk === 'high'
                                  ? 'bg-red-500/20 text-red-400'
                                  : loader.risk === 'medium'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                            >
                              {loader.risk} risk
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400">{loader.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="glass rounded-xl p-6 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    <h3 className="text-lg font-semibold">Recommendations</h3>
                  </div>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Scripts List - Only show external scripts, sorted by risk */}
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  External Scripts ({result.externalScripts})
                </h3>
                {result.externalScripts === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No external scripts found. Only inline scripts detected.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {result.scripts
                      .filter((s) => s.isExternal)
                      .sort((a, b) => {
                        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3, safe: 4 };
                        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
                      })
                      .map((script, i) => (
                        <ScriptCard key={i} script={script} />
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {!result && !loading && !error && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center py-16"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-zinc-800/50 text-zinc-500 mb-6">
                <Shield className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-medium text-zinc-300 mb-2">
                Enter a URL to scan
              </h3>
              <p className="text-zinc-500 max-w-md mx-auto">
                We'll analyze all scripts on the page and check for missing SRI attributes,
                compromised CDNs, and other security issues.
              </p>
            </motion.div>
          )}
        </div>
      </div>

      <Footer />

      {/* Fix Modal */}
      {result && (
        <FixModal
          isOpen={showFixModal}
          onClose={() => setShowFixModal(false)}
          scripts={result.scripts}
        />
      )}
    </main>
  );
}
