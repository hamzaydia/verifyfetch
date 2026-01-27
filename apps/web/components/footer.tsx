'use client';

import Image from 'next/image';
import { Github, Package, FileText } from 'lucide-react';

export function Footer() {
  return (
    <footer className="py-10 sm:py-12 md:py-16 px-4 sm:px-6 border-t border-zinc-800">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-8">
          {/* Logo & Description */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <Image src="/logo.svg" alt="VerifyFetch" width={32} height={32} />
              <span className="font-semibold text-lg">VerifyFetch</span>
            </div>
            <p className="text-zinc-500 text-sm text-center md:text-left max-w-xs">
              Streaming integrity verification for WASM, AI models, and large files.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-4 sm:gap-6 md:gap-8">
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-4">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://github.com/hamzaydia/verifyfetch#readme"
                    className="text-zinc-500 hover:text-white text-sm flex items-center gap-2 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/hamzaydia/verifyfetch"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-white text-sm flex items-center gap-2 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.npmjs.com/package/verifyfetch"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-white text-sm flex items-center gap-2 transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    npm
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://github.com/hamzaydia/verifyfetch/blob/main/LICENSE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-white text-sm transition-colors"
                  >
                    Apache-2.0 License
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/hamzaydia/verifyfetch/blob/main/SECURITY.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-white text-sm transition-colors"
                  >
                    Security Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 sm:mt-10 md:mt-12 pt-6 sm:pt-8 border-t border-zinc-800 text-center">
          <p className="text-zinc-500 text-sm">
            Made with care for secure web applications.
          </p>
        </div>
      </div>
    </footer>
  );
}
