'use client';

import { motion } from 'framer-motion';
import { Copy, Check, Github, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';

export function Hero() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('npm install verifyfetch');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="min-h-screen flex items-center justify-center pt-20 pb-16 px-6">
      <div className="max-w-4xl mx-auto text-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Image
            src="/logo.svg"
            alt="VerifyFetch"
            width={100}
            height={100}
            className="mx-auto"
          />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
        >
          Verify any file you fetch
          <br />
          <span className="gradient-text">—before you trust it.</span>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto"
        >
          Streaming integrity verification for WASM, AI models, and large files.
          <br />
          <span className="text-zinc-500">SRI for fetch() with constant 2MB memory.</span>
        </motion.p>

        {/* Install Command */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <button
            onClick={handleCopy}
            className="group inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-6 py-3 hover:border-primary/50 transition-all"
          >
            <span className="text-zinc-500">$</span>
            <code className="text-zinc-200">npm install verifyfetch</code>
            {copied ? (
              <Check className="w-4 h-4 text-primary" />
            ) : (
              <Copy className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
            )}
          </button>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="https://github.com/hamzaydia/verifyfetch#readme"
            className="btn-primary"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="https://github.com/hamzaydia/verifyfetch"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <Github className="w-4 h-4" />
            View on GitHub
          </a>
        </motion.div>

        {/* Code Example */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-16"
        >
          <div className="code-block text-left max-w-xl mx-auto">
            <pre className="text-sm">
              <code>
                <span className="text-purple-400">import</span>
                {' { verifyFetch } '}
                <span className="text-purple-400">from</span>
                {' '}
                <span className="text-emerald-400">'verifyfetch'</span>
                ;{'\n\n'}
                <span className="text-purple-400">const</span>
                {' response = '}
                <span className="text-purple-400">await</span>
                {' '}
                <span className="text-blue-400">verifyFetch</span>
                (<span className="text-emerald-400">'/model.bin'</span>, {'{\n'}
                {'  sri: '}
                <span className="text-emerald-400">'sha256-uU0nuZNN...'</span>
                {'\n}'});{'\n\n'}
                <span className="text-zinc-500">// That's it. Throws if hash doesn't match.</span>
              </code>
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
