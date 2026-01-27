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
    description: 'Zero-code integration. Verify every fetch automatically without changing your app.',
  },
  {
    icon: GitBranch,
    title: 'Merkle Tree Verification',
    description: 'Fail-fast chunked verification. Stop downloading if byte 0 is corrupt.',
  },
  {
    icon: Globe,
    title: 'Multi-CDN Failover',
    description: 'Automatic failover across CDNs with race, sequential, or fastest strategies.',
  },
  {
    icon: Zap,
    title: 'Streaming Output',
    description: 'Process chunks as they download. Constant memory for any file size.',
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
    title: 'Manifest System',
    description: 'Manage multiple files with JSON manifests. v2 supports Merkle trees.',
  },
  {
    icon: Terminal,
    title: 'CLI Tools',
    description: 'Generate hashes, Merkle trees, and enforce integrity in CI/CD.',
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
            Everything You Need
          </h2>
          <p className="text-zinc-400 text-center text-sm sm:text-base mb-8 sm:mb-10 md:mb-12 max-w-2xl mx-auto">
            Built for security-conscious developers who need to verify files at any scale.
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
