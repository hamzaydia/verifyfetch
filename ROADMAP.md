# VerifyFetch Roadmap

## Current Version: v0.2.0

### What's Included

**Core Features**
- [x] Streaming integrity verification (WASM SHA-256/384/512 with SubtleCrypto fallback)
- [x] SRI-compatible hash format
- [x] Progress callbacks for large files
- [x] TypeScript types

**v0.2.0 Features**
- [x] **Streaming API** - `verifyFetchStream()` for constant-memory verification
- [x] **Merkle Tree Support** - Fail-fast chunk verification with `--merkle` flag
- [x] **Service Worker Mode** - Zero-code integration via fetch interception
- [x] **Multi-CDN Failover** - `verifyFetchFromSources()` with race/sequential strategies

**CLI**
- [x] `sign` command - Generate SRI hashes and manifests
- [x] `enforce` command - CI/CD integrity enforcement
- [x] `init` command - Project initialization

**Web Tools (verifyfetch.com)**
- [x] `/scan` - Polyfill vulnerability scanner
- [x] `/generate` - SRI hash generator
- [x] `/playground` - Interactive demo

---

## v0.3.0 - Signatures & Framework Integration

### Core Features
- [ ] **Ed25519 signature verification** - Cryptographic signatures for publisher verification
- [ ] **Signature CLI** - `npx verifyfetch sign --key private.pem`
- [ ] **Public key pinning** - Verify files come from trusted publishers

### Framework Integration
- [ ] **Next.js `withVerifyFetch`** - Auto-manifest generation at build time
- [ ] **Vite plugin** - Full integration with manifest auto-generation
- [ ] **Webpack plugin** - For non-Next.js webpack projects

### Developer Experience
- [ ] **Better error messages** - Include fix suggestions in all errors
- [ ] **Debug mode** - Verbose logging for troubleshooting
- [ ] **Config file support** - `.verifyfetchrc` for default options

---

## v0.4.0 - WebAI Package

### @verifyfetch/ai
- [ ] **createVerifiedModelLoader()** - High-level API for AI model loading
- [ ] **WebLLM integration** - Verified model loading for WebLLM
- [ ] **Transformers.js integration** - Verified model loading for Transformers.js
- [ ] **ONNX Runtime Web integration** - Verified ONNX model loading
- [ ] **Progress UI components** - React components for download progress

### Performance
- [ ] **IndexedDB caching** - Cache verification results
- [ ] **Parallel chunk verification** - Verify chunks as they download
- [ ] **Worker thread support** - Offload hashing to web workers

---

## v0.5.0 - Enhanced Web Tools

### verifyfetch.com/scan
- [ ] **Export reports** - PDF/JSON vulnerability reports
- [ ] **Slack/Discord webhooks** - Alert on new vulnerabilities

### verifyfetch.com/generate
- [ ] **Signature generator** - Generate Ed25519 keypairs

### verifyfetch.com/playground
- [ ] **Shareable examples** - Link to specific configurations

---

## v1.0.0 - Production Ready

### Stability
- [ ] **100% test coverage** on core module
- [ ] **Fuzz testing** - Test with malformed inputs
- [ ] **Performance benchmarks** - Automated performance regression testing
- [ ] **Security audit** - Third-party security review

### Enterprise Features
- [ ] **Custom hash algorithms** - Plugin system for algorithms
- [ ] **Proxy support** - Corporate proxy configuration
- [ ] **Offline mode** - Work with cached manifests
- [ ] **Telemetry opt-in** - Anonymous usage statistics

---

## Future Ideas (Backlog)

### Integrations
- [ ] Deno-native module
- [ ] Bun-optimized version
- [ ] Cloudflare Workers support
- [ ] AWS Lambda support
- [ ] Browser extension

### Advanced Features
- [ ] Delta verification (only verify changed chunks)
- [ ] P2P verification (verify against multiple sources)
- [ ] Certificate transparency logging

### Community
- [ ] Discord server for support
- [ ] Contributor rewards program
- [ ] Conference talk submissions

---

## How to Contribute

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup
- Code style guidelines
- PR process
- Good first issues

### Priority Areas
1. **Framework plugins** - Next.js, Vite, Webpack
2. **Examples** - More framework-specific examples
3. **Performance** - Benchmark and optimize
4. **Documentation** - Improve inline docs
