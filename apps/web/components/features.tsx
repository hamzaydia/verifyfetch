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
  Code2,
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Streaming Verification',
    description: 'WASM-based SHA-256/384/512 with constant 2MB memory for any file size.',
  },
  {
    icon: RefreshCw,
    title: 'Fallback URLs',
    description: 'Auto-retry from backup servers on integrity failure.',
  },
  {
    icon: Activity,
    title: 'Progress Tracking',
    description: 'Monitor large downloads with real-time progress callbacks.',
  },
  {
    icon: FileJson,
    title: 'Manifest Mode',
    description: 'Manage multiple files with a single JSON manifest.',
  },
  {
    icon: Terminal,
    title: 'CLI Tools',
    description: 'Generate hashes and enforce integrity in CI/CD pipelines.',
  },
  {
    icon: Code2,
    title: 'TypeScript Ready',
    description: 'Full type safety with detailed JSDoc documentation.',
  },
];

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-6 bg-zinc-950/50">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Everything You Need
          </h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Built for security-conscious developers who need to verify files at any scale.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
