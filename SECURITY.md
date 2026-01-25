# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in VerifyFetch, please report it responsibly.

### How to Report

**Email:** security@verifyfetch.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### What to Expect

- **Acknowledgment:** Within 48 hours
- **Initial Assessment:** Within 7 days
- **Resolution Timeline:** Depends on severity, typically 30-90 days

### Disclosure Policy

- Please give us reasonable time to address the issue before public disclosure
- We will credit reporters in our security advisories (unless you prefer anonymity)
- We do not pursue legal action against researchers who follow responsible disclosure

### Scope

In scope:
- `verifyfetch` npm package
- `@verifyfetch/cli` npm package
- verifyfetch.com website

Out of scope:
- Third-party dependencies (report to their maintainers)
- Social engineering attacks
- Physical attacks

## Security Best Practices

When using VerifyFetch:

1. **Always verify critical assets** - WASM modules, AI models, configuration files
2. **Use strong algorithms** - Prefer SHA-384 or SHA-512 for high-security applications
3. **Keep manifests in version control** - Track changes to integrity hashes
4. **Run `enforce` in CI** - Catch tampering before deployment

## Known Limitations

- v0.1 supports hash verification only (signature verification coming in v0.2)
- SubtleCrypto fallback loads entire file into memory (use WASM for large files)
