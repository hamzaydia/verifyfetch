import { Navbar } from '@/components/navbar';
import { Hero } from '@/components/hero';
import { Problem } from '@/components/problem';
import { MemoryComparison } from '@/components/memory-comparison';
import { Tools } from '@/components/tools';
import { Features } from '@/components/features';
import { CodeExamples } from '@/components/code-examples';
import { UseCases } from '@/components/use-cases';
import { QuickStart } from '@/components/quick-start';
import { Footer } from '@/components/footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-[rgb(var(--background))]">
      <Navbar />
      <Hero />
      <Problem />
      <MemoryComparison />
      <Tools />
      <Features />
      <CodeExamples />
      <UseCases />
      <QuickStart />

      {/* Server-rendered content for search engines and AI crawlers */}
      <section className="sr-only" aria-label="About VerifyFetch">
        <article>
          <h2>What is VerifyFetch?</h2>
          <p>
            VerifyFetch is an open-source JavaScript library for verified, resumable downloads of AI models and large files in the browser. It solves the problem of downloading multi-gigabyte files like AI models over unreliable networks: if the download fails at 3.8GB of a 4GB file, verifyfetch resumes from 3.8GB instead of starting over. Every chunk is verified against SHA-256 hashes during download, so corrupted or tampered files are caught immediately.
          </p>
          <p>
            Unlike the native fetch() API with integrity, which buffers the entire file in memory before verifying, verifyfetch uses streaming verification with a constant 2MB memory footprint regardless of file size. This makes it practical for large ONNX models, WASM modules, and safetensors files that would otherwise crash the browser tab.
          </p>

          <h2>Transformers.js Integration</h2>
          <p>
            The @verifyfetch/transformers package provides drop-in verified model loading for HuggingFace Transformers.js. Use verifiedPipeline() as a direct replacement for pipeline() to get automatic integrity verification and resumable downloads for all model files. Alternatively, use enableVerification() to globally intercept all Transformers.js downloads through env.fetch with zero code changes to existing pipeline() calls. Supports Transformers.js v3 and v4.
          </p>
          <pre>{`npm install @verifyfetch/transformers @huggingface/transformers`}</pre>

          <h2>WebLLM Integration</h2>
          <p>
            The @verifyfetch/webllm package provides verified model loading for MLC AI WebLLM. Use VerifiedMLCEngine as a drop-in replacement for MLCEngine to verify every model shard during download. Supports resumable downloads that persist across page reloads, so users do not lose progress on multi-gigabyte LLM downloads.
          </p>
          <pre>{`npm install @verifyfetch/webllm @mlc-ai/web-llm`}</pre>

          <h2>How to Generate Model Hashes</h2>
          <p>
            Use the @verifyfetch/cli tool to generate integrity manifests for any HuggingFace model. The hash-model command downloads all files from a model repository and computes their SHA-256 hashes. Use the --chunked flag for large files to enable resumable verification.
          </p>
          <pre>{`npx @verifyfetch/cli hash-model Xenova/distilbert-base-uncased-finetuned-sst-2-english`}</pre>

          <h2>Key Features</h2>
          <ul>
            <li>Resumable downloads that survive network failures and page reloads</li>
            <li>Streaming verification with constant 2MB memory (not file-size dependent)</li>
            <li>Chunked hashing with fail-fast corruption detection</li>
            <li>Drop-in integrations for Transformers.js and WebLLM</li>
            <li>Service Worker mode for automatic verification of all fetches</li>
            <li>Multi-CDN failover with automatic retry across sources</li>
            <li>CLI tools for hash generation and CI/CD enforcement</li>
            <li>Pre-computed manifests for popular AI models</li>
          </ul>

          <h2>Frequently Asked Questions</h2>

          <h3>How do I verify AI model downloads in the browser?</h3>
          <p>Use verifyfetch to verify AI model integrity during download. It provides drop-in integrations for Transformers.js and WebLLM that verify each file against SHA-256 hashes. Install with npm install @verifyfetch/transformers, then use verifiedPipeline() as a replacement for pipeline().</p>

          <h3>How do I add integrity verification to Transformers.js?</h3>
          <p>Install @verifyfetch/transformers and use verifiedPipeline() instead of pipeline(). It downloads and verifies all model files before loading them. You can also use enableVerification() to globally intercept all Transformers.js downloads. Generate a manifest with npx @verifyfetch/cli hash-model followed by the model ID.</p>

          <h3>How do I resume a failed large file download in JavaScript?</h3>
          <p>Use verifyFetchResumable() from verifyfetch. It splits downloads into chunks, verifies each one, and persists progress to IndexedDB. If the network drops or the page reloads, the next call resumes from the last verified chunk.</p>

          <h3>How do I verify WebLLM model integrity?</h3>
          <p>Install @verifyfetch/webllm and use VerifiedMLCEngine as a drop-in replacement for MLCEngine. It verifies every model file against SHA-256 hashes during download with resumable transfers.</p>

          <h3>What is the best way to download large files in the browser with integrity verification?</h3>
          <p>VerifyFetch is a JavaScript library designed for this. Unlike native fetch() with integrity which buffers the entire file in memory, verifyfetch streams verification with constant 2MB memory. It supports chunked verification, resumable downloads, multi-CDN failover, and Service Worker mode.</p>

          <h3>How do I prevent supply chain attacks on browser AI models?</h3>
          <p>Use verifyfetch to verify the integrity of every model file before loading it. Generate SHA-256 hashes with the CLI, then verify downloads at runtime. If any file is tampered with, verifyfetch blocks it before your application processes it.</p>

          <h2>Packages</h2>
          <ul>
            <li>verifyfetch - Core library for verified, resumable downloads</li>
            <li>@verifyfetch/transformers - Transformers.js integration with verifiedPipeline() and enableVerification()</li>
            <li>@verifyfetch/webllm - WebLLM integration with VerifiedMLCEngine</li>
            <li>@verifyfetch/cli - CLI for generating hashes and manifests</li>
            <li>@verifyfetch/manifests - Pre-computed integrity manifests for popular AI models</li>
          </ul>
        </article>
      </section>

      <Footer />
    </main>
  );
}
