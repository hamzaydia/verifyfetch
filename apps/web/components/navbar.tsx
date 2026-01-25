'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Github, Package, Menu, X, Search, Hash, Code2 } from 'lucide-react';
import Image from 'next/image';

const tools = [
  { href: '/scan', label: 'Scanner', icon: Search },
  { href: '/generate', label: 'Generator', icon: Hash },
  { href: '/playground', label: 'Playground', icon: Code2 },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass py-3' : 'py-5'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Image src="/logo.svg" alt="VerifyFetch" width={32} height={32} className="flex-shrink-0" />
          <span className="font-semibold text-lg truncate">VerifyFetch</span>
        </a>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {/* Tools Dropdown Area */}
          <div className="flex items-center gap-1 mr-4">
            {tools.map((tool) => (
              <a
                key={tool.href}
                href={tool.href}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
              >
                <tool.icon className="w-4 h-4" />
                {tool.label}
              </a>
            ))}
          </div>

          <div className="w-px h-5 bg-zinc-700 mr-4" />

          <a
            href="https://github.com/hamzaydia/verifyfetch#full-api-reference"
            className="text-zinc-400 hover:text-white transition-colors text-sm px-3 py-2"
          >
            Docs
          </a>
          <a
            href="https://github.com/hamzaydia/verifyfetch"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 text-sm px-3 py-2"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/verifyfetch"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 text-sm px-3 py-2"
          >
            <Package className="w-4 h-4" />
            npm
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-zinc-400 hover:text-white p-2 -mr-2 flex-shrink-0"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden glass mt-2 mx-4 rounded-lg p-4"
        >
          <div className="flex flex-col gap-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              Tools
            </div>
            {tools.map((tool) => (
              <a
                key={tool.href}
                href={tool.href}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors py-2"
              >
                <tool.icon className="w-4 h-4" />
                {tool.label}
              </a>
            ))}

            <div className="border-t border-zinc-800 my-2" />

            <a
              href="https://github.com/hamzaydia/verifyfetch#full-api-reference"
              className="text-zinc-400 hover:text-white transition-colors py-2"
            >
              Docs
            </a>
            <a
              href="https://github.com/hamzaydia/verifyfetch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 py-2"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/verifyfetch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 py-2"
            >
              <Package className="w-4 h-4" />
              npm
            </a>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
