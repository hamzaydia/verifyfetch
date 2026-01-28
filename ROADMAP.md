# VerifyFetch Roadmap

## Current: v1.0.0

**Shipped and working:**

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

**Test coverage:** 338 tests passing (283 core + 55 webllm)

---

## Next: v1.1.0

**Goal:** Framework integrations and developer experience improvements.

- Pre-computed integrity hashes for popular WebLLM models (Phi-3, Llama, etc.)
- Next.js plugin for build-time manifest generation
- Vite plugin for build-time manifest generation

---

## Considering

These are ideas, not commitments:

- **Ed25519 signatures** - Verify publisher identity, not just file integrity
- **Worker thread hashing** - Offload to Web Workers for large files
- **Delta verification** - Only verify changed chunks

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup.

**Good first issues:**
- More framework examples (SvelteKit, Remix)
- Performance benchmarks
- Documentation improvements
