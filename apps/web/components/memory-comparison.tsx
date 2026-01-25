'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Zap, AlertTriangle, Skull } from 'lucide-react';

const comparisons = [
  { size: '100 MB', native: '100 MB', nativeStatus: 'ok', verifyfetch: '2 MB' },
  { size: '500 MB', native: '500 MB', nativeStatus: 'warn', verifyfetch: '2 MB' },
  { size: '1 GB', native: 'Slow, RAM spike', nativeStatus: 'warn', verifyfetch: '2 MB' },
  { size: '2 GB', native: 'Crashes', nativeStatus: 'dead', verifyfetch: '2 MB' },
  { size: '4 GB', native: 'Crashes', nativeStatus: 'dead', verifyfetch: '2 MB' },
];

export function MemoryComparison() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [activeIndex, setActiveIndex] = useState(2);

  return (
    <section ref={ref} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            The Problem with Native{' '}
            <code className="text-primary">crypto.subtle</code>
          </h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Native hashing loads the <strong className="text-zinc-200">entire file into memory</strong> before computing.
            VerifyFetch streams—constant memory for <strong className="text-zinc-200">any</strong> file size.
          </p>

          {/* Interactive Slider */}
          <div className="mb-12">
            <div className="flex justify-between text-sm text-zinc-500 mb-3">
              <span>100 MB</span>
              <span>File Size</span>
              <span>4 GB</span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              value={activeIndex}
              onChange={(e) => setActiveIndex(Number(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Comparison Display */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Native */}
            <motion.div
              key={`native-${activeIndex}`}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="feature-card relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
              <h3 className="text-sm font-mono text-zinc-500 mb-2">crypto.subtle.digest()</h3>
              <div className="flex items-center gap-3">
                {comparisons[activeIndex].nativeStatus === 'ok' && (
                  <Zap className="w-6 h-6 text-green-400" />
                )}
                {comparisons[activeIndex].nativeStatus === 'warn' && (
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                )}
                {comparisons[activeIndex].nativeStatus === 'dead' && (
                  <Skull className="w-6 h-6 text-red-400" />
                )}
                <span className="text-2xl font-bold">
                  {comparisons[activeIndex].native}
                </span>
              </div>
              <p className="text-zinc-500 text-sm mt-2">Memory usage</p>
            </motion.div>

            {/* VerifyFetch */}
            <motion.div
              key={`vf-${activeIndex}`}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="feature-card relative overflow-hidden border-primary/30"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <h3 className="text-sm font-mono text-zinc-500 mb-2">VerifyFetch</h3>
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-primary" />
                <span className="text-2xl font-bold text-primary">
                  {comparisons[activeIndex].verifyfetch}
                </span>
              </div>
              <p className="text-zinc-500 text-sm mt-2">Constant memory usage</p>
            </motion.div>
          </div>

          {/* Full Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="py-3 px-4 text-zinc-400 font-medium">File Size</th>
                  <th className="py-3 px-4 text-zinc-400 font-medium">Native</th>
                  <th className="py-3 px-4 text-zinc-400 font-medium">VerifyFetch</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, i) => (
                  <tr
                    key={row.size}
                    className={`border-b border-zinc-800/50 ${
                      i === activeIndex ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-sm">{row.size}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-2 ${
                          row.nativeStatus === 'ok'
                            ? 'text-green-400'
                            : row.nativeStatus === 'warn'
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {row.nativeStatus === 'dead' && <Skull className="w-4 h-4" />}
                        {row.nativeStatus === 'warn' && <AlertTriangle className="w-4 h-4" />}
                        {row.native}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-primary font-semibold">{row.verifyfetch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
