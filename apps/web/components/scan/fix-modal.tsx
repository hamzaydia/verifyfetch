'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Loader2,
  Copy,
  Check,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { ScriptInfo } from '@/lib/scanner';

interface FixModalProps {
  isOpen: boolean;
  onClose: () => void;
  scripts: ScriptInfo[];
}

interface GeneratedFix {
  url: string;
  hash: string;
  scriptTag: string;
  error?: string;
}

export function FixModal({ isOpen, onClose, scripts }: FixModalProps) {
  const [fixes, setFixes] = useState<GeneratedFix[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  // Only third-party scripts without SRI
  const vulnerableScripts = scripts.filter(
    (s) => s.isExternal && !s.hasIntegrity && s.src && !s.isFirstParty
  );

  // Auto-generate all SRIs when modal opens
  useEffect(() => {
    if (isOpen && vulnerableScripts.length > 0 && fixes.length === 0) {
      generateAll();
    }
  }, [isOpen]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFixes([]);
      setProgress(0);
      setCopied(false);
    }
  }, [isOpen]);

  const generateAll = async () => {
    setIsGenerating(true);
    setFixes([]);
    setProgress(0);

    const results: GeneratedFix[] = [];

    for (let i = 0; i < vulnerableScripts.length; i++) {
      const script = vulnerableScripts[i];

      try {
        const response = await fetch('/api/generate-sri/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: script.src }),
        });

        const data = await response.json();

        if (!response.ok) {
          results.push({ url: script.src, hash: '', scriptTag: '', error: data.error });
        } else {
          results.push({
            url: script.src,
            hash: data.hash,
            scriptTag: data.scriptTag,
          });
        }
      } catch {
        results.push({ url: script.src, hash: '', scriptTag: '', error: 'Failed to fetch' });
      }

      setProgress(Math.round(((i + 1) / vulnerableScripts.length) * 100));
      setFixes([...results]);
    }

    setIsGenerating(false);
  };

  const successfulFixes = fixes.filter((f) => f.scriptTag && !f.error);
  const failedFixes = fixes.filter((f) => f.error);

  const allFixedCode = successfulFixes.map((f) => f.scriptTag).join('\n\n');

  const copyAll = () => {
    if (allFixedCode) {
      navigator.clipboard.writeText(allFixedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800">
            <div>
              <h2 className="text-xl font-semibold">
                {isGenerating ? 'Generating SRI Hashes...' : 'Fixed Scripts'}
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                {isGenerating
                  ? `${progress}% complete`
                  : `${successfulFixes.length} of ${vulnerableScripts.length} scripts ready`
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          {isGenerating && (
            <div className="px-6 py-3 bg-zinc-800/50">
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Loading State */}
            {isGenerating && fixes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-zinc-400">Fetching scripts and computing hashes...</p>
              </div>
            )}

            {/* Results */}
            {!isGenerating && successfulFixes.length > 0 && (
              <div className="space-y-4">
                {/* Copy All Section */}
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-300">
                      Copy all {successfulFixes.length} fixed script tags:
                    </span>
                    <button
                      onClick={copyAll}
                      className="btn-primary text-sm py-2"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy All
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-emerald-400 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {allFixedCode}
                  </pre>
                </div>

                {/* Failed Scripts */}
                {failedFixes.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-medium text-red-400">
                        {failedFixes.length} script(s) failed
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {failedFixes.map((f, i) => (
                        <li key={i} className="text-xs text-red-300/70 truncate">
                          {f.url} - {f.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Success Message */}
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Replace your script tags with the code above to add SRI protection.</span>
                </div>
              </div>
            )}

            {/* No scripts to fix */}
            {!isGenerating && fixes.length === 0 && vulnerableScripts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
                <p className="text-zinc-300 font-medium">All scripts are protected!</p>
                <p className="text-zinc-500 text-sm">No third-party scripts need SRI.</p>
              </div>
            )}
          </div>

          {/* Footer - Why VerifyFetch */}
          {!isGenerating && successfulFixes.length > 0 && (
            <div className="border-t border-zinc-800 p-6 bg-gradient-to-b from-zinc-900 to-zinc-950">
              <div className="flex items-start gap-3 mb-4">
                <Zap className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-white">Want runtime protection too?</h3>
                  <p className="text-sm text-zinc-400 mt-1">
                    SRI protects the initial load. VerifyFetch adds streaming verification
                    for large files, automatic fallbacks, and works with fetch() for WASM & AI models.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 bg-zinc-800/50 rounded-lg p-3">
                <code className="text-sm text-zinc-400">
                  npm install verifyfetch
                </code>
                <a
                  href="/"
                  className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
                >
                  Learn more
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
