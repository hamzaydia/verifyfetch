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
    <section className="min-h-screen flex items-center justify-center pt-12 sm:pt-16 md:pt-20 pb-10 sm:pb-12 md:pb-16 px-4 sm:px-6">
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
          className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight"
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
          className="text-base sm:text-lg md:text-xl text-zinc-400 mb-6 sm:mb-8 md:mb-10 max-w-2xl mx-auto"
        >
          Streaming integrity verification for WASM, AI models, and large files.
          <br />
          <span className="text-zinc-500">Fail-fast Merkle trees. Zero-code Service Worker. Multi-CDN failover.</span>
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
            className="group inline-flex items-center gap-2 sm:gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-3 sm:px-4 md:px-6 py-2 sm:py-3 hover:border-primary/50 transition-all"
          >
            <span className="text-zinc-500">$</span>
            <code className="text-zinc-200 text-sm sm:text-base">npm install verifyfetch</code>
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
            href="#get-started"
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
          className="mt-8 sm:mt-12 md:mt-16"
        >
          <div className="max-w-xl mx-auto rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl shadow-primary/5">
            {/* Window Chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-zinc-500 ml-2 font-mono">app.ts</span>
            </div>
            {/* Code Content */}
            <div className="p-4 sm:p-5 text-left">
              <pre className="text-xs sm:text-sm leading-relaxed">
                <code>
                  <span className="text-purple-400">import</span>
                  <span className="text-zinc-300">{' { '}</span>
                  <span className="text-yellow-300">verifyFetch</span>
                  <span className="text-zinc-300">{' } '}</span>
                  <span className="text-purple-400">from</span>
                  {' '}
                  <span className="text-emerald-400">'verifyfetch'</span>
                  <span className="text-zinc-300">;</span>
                  {'\n\n'}
                  <span className="text-purple-400">const</span>
                  <span className="text-zinc-300">{' response = '}</span>
                  <span className="text-purple-400">await</span>
                  {' '}
                  <span className="text-blue-400">verifyFetch</span>
                  <span className="text-zinc-300">(</span>
                  <span className="text-emerald-400">'/model.bin'</span>
                  <span className="text-zinc-300">, {'{'}</span>
                  {'\n'}
                  <span className="text-zinc-300">{'  '}</span>
                  <span className="text-cyan-300">sri</span>
                  <span className="text-zinc-300">: </span>
                  <span className="text-emerald-400">'sha256-uU0nuZNN...'</span>
                  {'\n'}
                  <span className="text-zinc-300">{'}'});</span>
                  {'\n\n'}
                  <span className="text-zinc-600">// Throws if tampered. Zero config.</span>
                </code>
              </pre>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
