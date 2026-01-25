# Contributing to VerifyFetch

Thank you for your interest in contributing to VerifyFetch! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We're building security infrastructure that protects users - let's do it together with professionalism and kindness.

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **pnpm** 9+ (`npm install -g pnpm`)
- **Rust** (for WASM development) - [Install Rust](https://rustup.rs/)
- **wasm-pack** - `cargo install wasm-pack`

### Setup

```bash
# Clone the repository
git clone https://github.com/hamzaydia/verifyfetch.git
cd verifyfetch

# Install dependencies
pnpm install

# Build WASM module
pnpm build:wasm

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Project Structure

```
verifyfetch/
├── packages/
│   ├── core/           # Main library (TypeScript + WASM)
│   │   ├── src/        # TypeScript source
│   │   └── wasm/       # Rust WASM hasher
│   ├── cli/            # CLI tool
│   └── next/           # Next.js integration (coming soon)
├── apps/
│   └── web/            # Documentation site (coming soon)
└── examples/           # Usage examples
```

## Development Workflow

### Making Changes

1. **Fork** the repository
2. **Create a branch** for your feature/fix: `git checkout -b feature/my-feature`
3. **Make your changes**
4. **Add tests** for new functionality
5. **Run tests**: `pnpm test`
6. **Build**: `pnpm build`
7. **Commit** with a clear message
8. **Push** and open a PR

### Commit Messages

We use conventional commits:

```
feat: add signature verification
fix: handle empty files correctly
docs: update API documentation
test: add tests for streaming hasher
chore: update dependencies
```

### Code Style

- TypeScript with strict mode
- Use ESM (no CommonJS)
- Prefer functional style where appropriate
- Document public APIs with JSDoc
- Keep functions focused and small

## Areas to Contribute

### Good First Issues

Look for issues labeled `good-first-issue`:
- Documentation improvements
- Adding tests
- Bug fixes with clear reproduction steps

### Wanted Features

- Additional framework integrations (Vite, Remix, SvelteKit)
- Performance optimizations
- CI/CD integration examples
- Better error messages

### WASM Contributions

The Rust WASM code is in `packages/core/wasm/`. Contributions welcome:
- Performance improvements
- Additional hash algorithms (BLAKE3)
- Signature verification in WASM

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run tests for a specific package
pnpm --filter verifyfetch test
```

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add changeset if your change is user-facing: `pnpm changeset`
4. Request review from maintainers
5. Address feedback
6. Squash and merge

## Security

If you discover a security vulnerability, please **do not** open a public issue. Instead, email security@verifyfetch.com with details.

## Questions?

- Open a [Discussion](https://github.com/hamzaydia/verifyfetch/discussions)
- Check existing [Issues](https://github.com/hamzaydia/verifyfetch/issues)

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 license.

---

Thank you for helping make the web more secure! 🛡️
