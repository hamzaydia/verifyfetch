'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  Zap,
  RefreshCw,
  Activity,
  FileJson,
  Terminal,
  Shield,
  GitBranch,
  Globe,
} from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Service Worker Mode',
    description: 'Add one file, verify all fetches. No changes to existing code needed.',
  },
  {
    icon: GitBranch,
    title: 'Chunked Verification',
    description: 'Detect corruption at chunk 5, stop immediately. Don\'t download 3995 more chunks.',
  },
  {
    icon: Globe,
    title: 'Multi-CDN Failover',
    description: 'Try CDN1, CDN2, CDN3. First verified response wins.',
  },
  {
    icon: Zap,
    title: 'Streaming Output',
    description: '2MB memory for a 4GB file. Process chunks as they arrive.',
  },
  {
    icon: RefreshCw,
    title: 'Resumable Downloads',
    description: 'Network fails at 80%? Resume from 80%. Progress persists to IndexedDB.',
  },
  {
    icon: Activity,
    title: 'Progress Tracking',
    description: 'Bytes loaded, percent complete, ETA. All in one callback.',
  },
  {
    icon: FileJson,
    title: 'Manifest System',
    description: 'One JSON file for all your hashes. CLI generates it from your files.',
  },
  {
    icon: Terminal,
    title: 'CLI Tools',
    description: 'npx verifyfetch sign *.wasm - done. Enforce in CI with one command.',
  },
];

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-12 sm:py-16 md:py-24 px-4 sm:px-6 bg-zinc-950/50">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4">
            What You Get
          </h2>
          <p className="text-zinc-400 text-center text-sm sm:text-base mb-8 sm:mb-10 md:mb-12 max-w-2xl mx-auto">
            Everything needed to download, verify, and resume large files in the browser.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ y: 20, opacity: 0 }}
                animate={isInView ? { y: 0, opacity: 1 } : {}}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="feature-card group"
              >
                <div className="p-3 w-fit rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-zinc-400 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
