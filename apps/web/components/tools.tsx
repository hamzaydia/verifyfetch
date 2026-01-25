'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Search, Hash, Code2, ArrowRight } from 'lucide-react';

const tools = [
  {
    icon: Search,
    title: 'Polyfill Scanner',
    description: 'Scan any website for vulnerable scripts. Detect missing SRI, compromised CDNs, and supply chain risks.',
    href: '/scan',
    color: 'from-red-500/20 to-orange-500/20',
    borderColor: 'hover:border-red-500/50',
  },
  {
    icon: Hash,
    title: 'SRI Generator',
    description: 'Generate SRI hashes for your files, create Ed25519 keypairs, and build verification manifests.',
    href: '/generate',
    color: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'hover:border-blue-500/50',
  },
  {
    icon: Code2,
    title: 'Playground',
    description: 'Try VerifyFetch in your browser. Edit code, explore examples, and see the memory benefits live.',
    href: '/playground',
    color: 'from-emerald-500/20 to-teal-500/20',
    borderColor: 'hover:border-emerald-500/50',
  },
];

export function Tools() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Free Security Tools
          </h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Powerful browser-based tools to help you secure your applications.
            No installation required.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {tools.map((tool, i) => (
              <motion.a
                key={tool.title}
                href={tool.href}
                initial={{ y: 20, opacity: 0 }}
                animate={isInView ? { y: 0, opacity: 1 } : {}}
                transition={{ delay: 0.1 + i * 0.1 }}
                className={`group relative overflow-hidden rounded-xl border border-zinc-800 ${tool.borderColor} transition-all duration-300`}
              >
                {/* Gradient Background */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                />

                <div className="relative p-6">
                  <div className="p-3 w-fit rounded-lg bg-zinc-800 text-zinc-300 mb-4 group-hover:bg-zinc-700 transition-colors">
                    <tool.icon className="w-6 h-6" />
                  </div>

                  <h3 className="font-semibold text-white text-lg mb-2">
                    {tool.title}
                  </h3>

                  <p className="text-zinc-400 text-sm mb-4">
                    {tool.description}
                  </p>

                  <div className="flex items-center gap-2 text-primary text-sm font-medium">
                    Try it free
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
