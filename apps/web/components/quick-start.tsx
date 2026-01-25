'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Copy, Check, ArrowRight } from 'lucide-react';

const steps = [
  {
    number: '1',
    title: 'Install',
    code: 'npm install verifyfetch',
  },
  {
    number: '2',
    title: 'Generate hashes',
    code: 'npx @verifyfetch/cli sign ./public/*.wasm',
  },
  {
    number: '3',
    title: 'Verify in your app',
    code: `import { verifyFetch } from 'verifyfetch';

const res = await verifyFetch('/engine.wasm', {
  sri: 'sha256-...'
});`,
  },
  {
    number: '4',
    title: 'Enforce in CI',
    code: 'npx @verifyfetch/cli enforce',
  },
];

export function QuickStart() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <section ref={ref} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Get Started in 30 Seconds
          </h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Four steps to protect your users from supply chain attacks.
          </p>

          <div className="space-y-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ x: -20, opacity: 0 }}
                animate={isInView ? { x: 0, opacity: 1 } : {}}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="flex gap-6"
              >
                {/* Step Number */}
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold">
                    {step.number}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px h-full bg-zinc-800 mx-auto mt-2" />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 pb-6">
                  <h3 className="font-semibold text-white mb-3">{step.title}</h3>
                  <div className="relative">
                    <button
                      onClick={() => handleCopy(step.code, i)}
                      className="absolute top-3 right-3 p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    >
                      {copiedIndex === i ? (
                        <Check className="w-3 h-3 text-primary" />
                      ) : (
                        <Copy className="w-3 h-3 text-zinc-400" />
                      )}
                    </button>
                    <div className="code-block">
                      <pre className="text-sm">
                        <code className="text-zinc-300">{step.code}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ delay: 0.6 }}
            className="text-center mt-12"
          >
            <a
              href="https://github.com/hamzaydia/verifyfetch#readme"
              className="btn-primary"
            >
              Read the Full Documentation
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
