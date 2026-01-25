import { NextRequest, NextResponse } from 'next/server';
import { generateScanResult } from '@/lib/scanner';

export const runtime = 'nodejs';

// Timeout for fetch requests (15 seconds)
const FETCH_TIMEOUT = 15000;

// Maximum HTML size to process (5MB)
const MAX_HTML_SIZE = 5 * 1024 * 1024;

function getNetworkErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: Error }).cause;

    // Check for specific network error codes
    if (cause && typeof cause === 'object' && 'code' in cause) {
      const code = (cause as { code: string }).code;
      switch (code) {
        case 'ENOTFOUND':
          return 'Domain not found. Please check the URL and try again.';
        case 'ECONNREFUSED':
          return 'Connection refused. The server may be down or blocking requests.';
        case 'ETIMEDOUT':
        case 'ESOCKETTIMEDOUT':
          return 'Connection timed out. The server took too long to respond.';
        case 'ECONNRESET':
          return 'Connection reset by server. Please try again.';
        case 'CERT_HAS_EXPIRED':
        case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
          return 'SSL certificate error. The website may have an invalid certificate.';
        default:
          return `Network error: ${code}`;
      }
    }

    // Check for abort/timeout
    if (error.name === 'AbortError') {
      return 'Request timed out. The website took too long to respond.';
    }

    return error.message || 'Failed to fetch URL';
  }

  return 'An unexpected error occurred while fetching the URL.';
}

export async function POST(request: NextRequest) {
  try {
    let body: { url?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Please send valid JSON.' },
        { status: 400 }
      );
    }

    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return NextResponse.json(
        { error: 'URL cannot be empty' },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      // Add protocol if missing
      let urlToValidate = trimmedUrl;
      if (!urlToValidate.startsWith('http://') && !urlToValidate.startsWith('https://')) {
        urlToValidate = `https://${urlToValidate}`;
      }

      parsedUrl = new URL(urlToValidate);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL. Please enter a valid HTTP or HTTPS URL (e.g., https://example.com)' },
        { status: 400 }
      );
    }

    // Block localhost and private IPs for security
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
        { error: 'Scanning localhost or private IP addresses is not allowed for security reasons.' },
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
          'User-Agent': 'VerifyFetch Scanner/1.0 (https://verifyfetch.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
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
        { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return NextResponse.json(
        { error: `URL does not return HTML content. Content-Type: ${contentType}` },
        { status: 400 }
      );
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_HTML_SIZE) {
      return NextResponse.json(
        { error: 'Page is too large to scan (max 5MB)' },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Additional size check for chunked responses
    if (html.length > MAX_HTML_SIZE) {
      return NextResponse.json(
        { error: 'Page is too large to scan (max 5MB)' },
        { status: 400 }
      );
    }

    const result = generateScanResult(html, parsedUrl.href);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scan error:', error);

    // Return user-friendly error
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
