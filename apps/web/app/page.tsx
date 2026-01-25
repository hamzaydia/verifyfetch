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
      <Footer />
    </main>
  );
}
