'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Check, X } from 'lucide-react';

const comparisons = [
  { feature: 'Basic SRI Verification', native: true, verifyfetch: true },
  { feature: 'Progress Callbacks', native: false, verifyfetch: true },
  { feature: 'Streaming Output', native: false, verifyfetch: true },
  { feature: 'Service Worker Mode', native: false, verifyfetch: true },
  { feature: 'Merkle Tree (Fail-Fast)', native: false, verifyfetch: true },
  { feature: 'Multi-CDN Failover', native: false, verifyfetch: true },
  { feature: 'Fallback URLs', native: false, verifyfetch: true },
  { feature: 'Manifest System', native: false, verifyfetch: true },
  { feature: 'CI/CD Enforcement', native: false, verifyfetch: true },
];

export function MemoryComparison() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-12 sm:py-16 md:py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4">
            Why Not Just Use Native{' '}
            <code className="text-primary text-xl sm:text-2xl md:text-3xl">fetch(&#123; integrity &#125;)</code>?
          </h2>
          <p className="text-zinc-400 text-center text-sm sm:text-base mb-8 sm:mb-10 md:mb-12 max-w-2xl mx-auto">
            Native fetch has basic SRI verification, but VerifyFetch gives you
            powerful features for production security.
          </p>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="py-2 sm:py-3 md:py-4 px-2 sm:px-3 md:px-4 text-zinc-400 font-medium text-xs sm:text-sm md:text-base">Feature</th>
                  <th className="py-2 sm:py-3 md:py-4 px-2 sm:px-3 md:px-4 text-zinc-400 font-medium text-center text-xs sm:text-sm md:text-base">
                    Native fetch
                  </th>
                  <th className="py-2 sm:py-3 md:py-4 px-2 sm:px-3 md:px-4 text-zinc-400 font-medium text-center text-xs sm:text-sm md:text-base">
                    VerifyFetch
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, i) => (
                  <motion.tr
                    key={row.feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="py-2 sm:py-3 md:py-4 px-2 sm:px-3 md:px-4 font-medium text-xs sm:text-sm md:text-base">{row.feature}</td>
                    <td className="py-2 sm:py-3 md:py-4 px-2 sm:px-3 md:px-4 text-center">
                      {row.native ? (
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-2 sm:py-3 md:py-4 px-2 sm:px-3 md:px-4 text-center">
                      {row.verifyfetch ? (
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 text-primary mx-auto" />
                      ) : (
                        <X className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-600 mx-auto" />
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Highlight */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8 }}
            className="mt-6 sm:mt-8 p-4 sm:p-6 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20"
          >
            <p className="text-center text-zinc-300">
              <strong className="text-primary">Service Worker mode</strong> lets you protect
              every fetch in your app with <strong className="text-white">zero code changes</strong>.
              Just add one line to your service worker.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
