'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

export function Problem() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-6 bg-zinc-950/50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-6">
            Why VerifyFetch?
          </h2>

          <div className="glass rounded-2xl p-8 md:p-12 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xl text-zinc-200 mb-2">
                  <code className="text-primary bg-primary/10 px-2 py-0.5 rounded">
                    fetch()
                  </code>{' '}
                  has integrity, but it{' '}
                  <strong>buffers the entire file</strong> first.
                </p>
                <p className="text-lg text-zinc-400">
                  A 4GB AI model needs 4GB+ RAM just to verify the hash.
                </p>
              </div>
            </div>

            <div className="border-l-2 border-red-500/50 pl-6 py-4 bg-red-500/5 rounded-r-lg">
              <p className="text-zinc-300 mb-3">
                Large WASM modules and AI models? Native verification crashes your browser.
              </p>
              <p className="text-zinc-400">
                One CDN compromise = malicious code in your users' browsers.
              </p>
              <a
                href="https://sansec.io/research/polyfill-supply-chain-attack"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 mt-3 text-sm"
              >
                It's happened before.
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Timeline of Attacks */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                year: '2024',
                title: 'Polyfill.io',
                desc: '100,000+ sites compromised via CDN takeover',
              },
              {
                year: '2021',
                title: 'ua-parser-js',
                desc: '7M weekly downloads served malware',
              },
              {
                year: '2018',
                title: 'event-stream',
                desc: 'Bitcoin wallet credentials stolen',
              },
            ].map((attack, i) => (
              <motion.div
                key={attack.title}
                initial={{ y: 20, opacity: 0 }}
                animate={isInView ? { y: 0, opacity: 1 } : {}}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="feature-card"
              >
                <div className="text-xs text-primary font-mono mb-2">{attack.year}</div>
                <h3 className="font-semibold text-white mb-1">{attack.title}</h3>
                <p className="text-sm text-zinc-400">{attack.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
