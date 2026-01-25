'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Box, Brain, FileCode, Binary } from 'lucide-react';

const useCases = [
  {
    icon: Box,
    title: 'WebAssembly',
    description: 'Verify .wasm modules before instantiation. Protect your compiled code.',
    example: '/engine.wasm',
  },
  {
    icon: Brain,
    title: 'AI Models',
    description: 'Secure multi-GB model downloads. WebLLM, ONNX, transformers.js.',
    example: '/models/phi-3-mini.bin',
  },
  {
    icon: FileCode,
    title: 'Config Files',
    description: 'Ensure critical JSON/YAML isn\'t tampered. Settings, schemas, rules.',
    example: '/config/settings.json',
  },
  {
    icon: Binary,
    title: 'Any Binary',
    description: 'Fonts, images, data files. If you fetch it, verify it.',
    example: '/assets/data.bin',
  },
];

export function UseCases() {
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
            Built for Critical Assets
          </h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Protect the files that power your application.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {useCases.map((useCase, i) => (
              <motion.div
                key={useCase.title}
                initial={{ y: 20, opacity: 0 }}
                animate={isInView ? { y: 0, opacity: 1 } : {}}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="feature-card group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <useCase.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-lg mb-1">
                      {useCase.title}
                    </h3>
                    <p className="text-zinc-400 text-sm mb-3">{useCase.description}</p>
                    <code className="text-xs text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded font-mono">
                      {useCase.example}
                    </code>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
