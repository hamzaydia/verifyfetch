import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

// Timeout for fetch requests (10 seconds)
const FETCH_TIMEOUT = 10000;

// Maximum file size to hash (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface SRIResult {
  url: string;
  hash: string;
  algorithm: 'sha256' | 'sha384' | 'sha512';
  scriptTag: string;
  linkTag: string;
}

function getNetworkErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: Error }).cause;

    if (cause && typeof cause === 'object' && 'code' in cause) {
      const code = (cause as { code: string }).code;
      switch (code) {
        case 'ENOTFOUND':
          return 'Domain not found. Please check the URL.';
        case 'ECONNREFUSED':
          return 'Connection refused. The server may be down.';
        case 'ETIMEDOUT':
        case 'ESOCKETTIMEDOUT':
          return 'Connection timed out.';
        case 'ECONNRESET':
          return 'Connection reset by server.';
        default:
          return `Network error: ${code}`;
      }
    }

    if (error.name === 'AbortError') {
      return 'Request timed out.';
    }

    return error.message || 'Failed to fetch URL';
  }

  return 'An unexpected error occurred.';
}

export async function POST(request: NextRequest) {
  try {
    let body: { url?: string; algorithm?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const { url, algorithm = 'sha384' } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate algorithm
    const validAlgorithms = ['sha256', 'sha384', 'sha512'];
    if (!validAlgorithms.includes(algorithm)) {
      return NextResponse.json(
        { error: 'Invalid algorithm. Use sha256, sha384, or sha512.' },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL. Please provide a valid HTTP(S) URL.' },
        { status: 400 }
      );
    }

    // Block localhost and private IPs
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname === '0.0.0.0'
    ) {
      return NextResponse.json(
        { error: 'Cannot fetch from localhost or private IPs.' },
        { status: 400 }
      );
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(parsedUrl.href, {
        headers: {
          'User-Agent': 'VerifyFetch SRI Generator/1.0',
          'Accept': '*/*',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const message = getNetworkErrorMessage(fetchError);
      return NextResponse.json({ error: message }, { status: 400 });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too large (max 10MB)' },
        { status: 400 }
      );
    }

    // Get the file content
    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too large (max 10MB)' },
        { status: 400 }
      );
    }

    // Compute hash
    const buffer = Buffer.from(arrayBuffer);
    const hash = createHash(algorithm).update(buffer).digest('base64');
    const sriHash = `${algorithm}-${hash}`;

    // Generate tags
    const scriptTag = `<script src="${url}" integrity="${sriHash}" crossorigin="anonymous"></script>`;
    const linkTag = `<link rel="stylesheet" href="${url}" integrity="${sriHash}" crossorigin="anonymous">`;

    const result: SRIResult = {
      url,
      hash: sriHash,
      algorithm: algorithm as 'sha256' | 'sha384' | 'sha512',
      scriptTag,
      linkTag,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('SRI generation error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
