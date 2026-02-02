# VerifyFetch Roadmap

## Current: v1.1.0

**Theme: Protect Every AI Model in Your Browser**

**New in v1.1.0:**

- **Transformers.js integration** (`@verifyfetch/transformers` package)
  - `verifiedPipeline()` - drop-in verified pipeline wrapper
  - `enableVerification()` - global verification for all Transformers.js downloads
  - `preloadVerifiedModel()` - pre-download and verify HF model files
  - Integrates via `env.customFetch` — no monkey-patching
- **CLI `hash-model` command** - Generate manifests for any Hugging Face model
  - `npx verifyfetch hash-model Xenova/distilbert-base-uncased-finetuned-sst-2-english`
  - Auto-detects ML files (ONNX, tokenizer, config)
  - Supports `--chunked` for large model files
- **Pre-computed manifests** (`@verifyfetch/manifests` package)
  - Ready-to-use hashes for popular Transformers.js and WebLLM models

**Shipped in v1.0.0:**

- Streaming integrity verification (constant 2MB memory for any file size)
- Chunked verification with fail-fast (detect corruption at chunk N, stop immediately)
- Resumable downloads (persist to IndexedDB, resume on page reload)
- Service Worker integration (automatic verification for all matching fetches)
- Multi-CDN failover (sequential, race, fastest strategies)
- CLI tools (`sign`, `enforce`, `init`)
- Manifest system (v1 simple, v2 with chunked hashes)
- **WebLLM integration** (`@verifyfetch/webllm` package)
  - `VerifiedMLCEngine` - drop-in replacement for MLCEngine with verification
  - `preloadVerifiedModel` - pre-download and verify before WebLLM loads
  - Model manifest format with chunked hashes for large shards
  - Addresses [WebLLM issue #761](https://github.com/mlc-ai/web-llm/issues/761)

**Test coverage:** 338+ tests passing

---

## Next: v1.2.0

**Goal:** Build plugins and broader ecosystem.

- Next.js plugin for build-time manifest generation
- Vite plugin for build-time manifest generation
- ONNX Runtime Web integration
- More pre-computed manifests for popular models

---

## Considering

These are ideas, not commitments:

- **Ed25519 signatures** - Verify publisher identity, not just file integrity
- **Worker thread hashing** - Offload to Web Workers for large files
- **Delta verification** - Only verify changed chunks
- **MediaPipe integration** - Verified loading for MediaPipe models

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup.

**Good first issues:**
- More framework examples (SvelteKit, Remix)
- Performance benchmarks
- Documentation improvements
- Pre-compute manifests for more popular models
