'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Box, Brain, FileCode, Binary, Sparkles, MessageSquare } from 'lucide-react';

const useCases = [
  {
    icon: Sparkles,
    title: 'Transformers.js',
    description: 'Verified model loading for HuggingFace Transformers.js. Drop-in pipeline() replacement with integrity checks and resumable downloads.',
    example: 'npm install @verifyfetch/transformers',
  },
  {
    icon: MessageSquare,
    title: 'WebLLM',
    description: 'Run LLMs in the browser with verified model weights. Drop-in MLCEngine replacement that catches tampered or corrupted shards.',
    example: 'npm install @verifyfetch/webllm',
  },
  {
    icon: Box,
    title: 'WebAssembly',
    description: 'Verify .wasm modules before instantiation. Protect compiled code from supply chain attacks.',
    example: '/engine.wasm',
  },
  {
    icon: Brain,
    title: 'ONNX Runtime',
    description: 'Secure multi-GB ONNX model downloads. Resumable transfers that survive page reloads and network drops.',
    example: '/models/model.onnx',
  },
  {
    icon: FileCode,
    title: 'Config Files',
    description: 'Ensure critical JSON and YAML files are not tampered with. Verify settings, schemas, and rules.',
    example: '/config/settings.json',
  },
  {
    icon: Binary,
    title: 'Any Binary',
    description: 'Fonts, images, datasets, safetensors. If you fetch it, verify it.',
    example: '/assets/data.bin',
  },
];

export function UseCases() {
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
            Built for Critical Assets
          </h2>
          <p className="text-zinc-400 text-center text-sm sm:text-base mb-8 sm:mb-10 md:mb-12 max-w-2xl mx-auto">
            Protect the files that power your application.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            {useCases.map((useCase, i) => (
              <motion.div
                key={useCase.title}
                initial={{ y: 20, opacity: 0 }}
                animate={isInView ? { y: 0, opacity: 1 } : {}}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="feature-card group"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <useCase.icon className="w-5 h-5 sm:w-6 sm:h-6" />
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
