import * as cheerio from 'cheerio';

export interface ScriptInfo {
  src: string;
  hasIntegrity: boolean;
  integrity?: string;
  crossorigin?: string;
  isExternal: boolean;
  isInline: boolean;
  isFirstParty: boolean;
  domain?: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  riskReason: string;
}

export interface DynamicLoaderInfo {
  name: string;
  type: 'tag_manager' | 'analytics' | 'advertising' | 'widget' | 'a_b_testing' | 'error_tracking' | 'cdn';
  detected: boolean;
  scriptSrc?: string;
  risk: 'high' | 'medium' | 'low';
  description: string;
}

export interface ScanResult {
  url: string;
  scannedAt: string;
  totalScripts: number;
  externalScripts: number;
  inlineScripts: number;
  firstPartyScripts: number;
  thirdPartyScripts: number;
  vulnerableScripts: number;
  overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  scripts: ScriptInfo[];
  dynamicLoaders: DynamicLoaderInfo[];
  warnings: string[];
  recommendations: string[];
}

// Known compromised or risky sources
const COMPROMISED_SOURCES = [
  'polyfill.io',
  'cdn.polyfill.io',
  'polyfill.com',
  'bootcss.com',
  'bootcdn.net',
  'staticfile.org',
];

// Trusted CDNs that are generally safe
const TRUSTED_CDNS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'ajax.googleapis.com',
  'code.jquery.com',
  'stackpath.bootstrapcdn.com',
  'cdn.tailwindcss.com',
  'esm.sh',
  'cdn.skypack.dev',
  'ga.jspm.io',
  'assets.codepen.io',
  'cdn.rawgit.com',
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
];

// Known affiliated domains (asset CDNs owned by the same company)
// Maps asset domain -> parent company domain
const AFFILIATED_DOMAINS: Record<string, string> = {
  'githubassets.com': 'github.com',
  'githubusercontent.com': 'github.com',
  'github.io': 'github.com',
  'gstatic.com': 'google.com',
  'googleusercontent.com': 'google.com',
  'googlesyndication.com': 'google.com',
  'googleadservices.com': 'google.com',
  'googleapis.com': 'google.com',
  'fbcdn.net': 'facebook.com',
  'fbsbx.com': 'facebook.com',
  'facebook.net': 'facebook.com',
  'twimg.com': 'twitter.com',
  'twitch.tv': 'twitch.tv',
  'twitchcdn.net': 'twitch.tv',
  'akamaihd.net': 'akamai.com',
  'cloudfront.net': 'amazonaws.com',
  's3.amazonaws.com': 'amazonaws.com',
  'azureedge.net': 'microsoft.com',
  'msecnd.net': 'microsoft.com',
  'aspnetcdn.com': 'microsoft.com',
  'licdn.com': 'linkedin.com',
  'pinimg.com': 'pinterest.com',
  'redditmedia.com': 'reddit.com',
  'redditstatic.com': 'reddit.com',
  'shopifycdn.com': 'shopify.com',
  'shopify.com': 'shopify.com',
  'stripe.com': 'stripe.com',
  'stripecdn.com': 'stripe.com',
  'spotifycdn.com': 'spotify.com',
  'scdn.co': 'spotify.com',
  'discordapp.com': 'discord.com',
  'discordapp.net': 'discord.com',
  'vercel.app': 'vercel.com',
  'vercel-scripts.com': 'vercel.com',
  'apple-mapkit.com': 'apple.com',
  'mzstatic.com': 'apple.com',
  'icloud.com': 'apple.com',
  'nflxext.com': 'netflix.com',
  'nflximg.net': 'netflix.com',
  'nflxso.net': 'netflix.com',
  'nflxvideo.net': 'netflix.com',
  'ytimg.com': 'youtube.com',
  'ggpht.com': 'youtube.com',
  'alicdn.com': 'alibaba.com',
  'alipayobjects.com': 'alibaba.com',
};

function getDomain(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return undefined;
  }
}

function getBaseDomain(hostname: string): string {
  // Extract base domain (e.g., "github.com" from "github.githubassets.com")
  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return hostname;
  }
  // Handle common TLDs like .co.uk, .com.au, etc.
  const commonTLDs = ['co.uk', 'com.au', 'co.nz', 'com.br', 'co.jp'];
  const lastTwo = parts.slice(-2).join('.');
  if (commonTLDs.includes(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function getAffiliatedBaseDomain(hostname: string): string {
  const baseDomain = getBaseDomain(hostname);

  // Check if this is a known affiliated domain
  for (const [assetDomain, parentDomain] of Object.entries(AFFILIATED_DOMAINS)) {
    if (baseDomain === assetDomain || hostname.endsWith(`.${assetDomain}`)) {
      return parentDomain;
    }
  }

  return baseDomain;
}

function isFirstParty(scriptDomain: string, pageDomain: string): boolean {
  if (!scriptDomain || !pageDomain) return false;

  // Exact match
  if (scriptDomain === pageDomain) return true;

  // Check if they share the same base domain
  const scriptBase = getBaseDomain(scriptDomain);
  const pageBase = getBaseDomain(pageDomain);

  if (scriptBase === pageBase) return true;

  // Check affiliated domains (e.g., githubassets.com belongs to github.com)
  const scriptAffiliated = getAffiliatedBaseDomain(scriptDomain);
  const pageAffiliated = getAffiliatedBaseDomain(pageDomain);

  return scriptAffiliated === pageAffiliated;
}

function isCompromisedSource(domain: string): boolean {
  return COMPROMISED_SOURCES.some(
    (source) => domain === source || domain.endsWith(`.${source}`)
  );
}

function isTrustedCDN(domain: string): boolean {
  return TRUSTED_CDNS.some(
    (cdn) => domain === cdn || domain.endsWith(`.${cdn}`)
  );
}

interface AssessRiskContext {
  script: Partial<ScriptInfo>;
  pageDomain: string;
}

function assessRisk({ script, pageDomain }: AssessRiskContext): { level: ScriptInfo['riskLevel']; reason: string } {
  if (!script.isExternal) {
    return { level: 'safe', reason: 'Inline script (no external dependency)' };
  }

  const domain = script.domain;
  if (!domain) {
    // Handle data: and blob: URLs
    if (script.src?.startsWith('data:') || script.src?.startsWith('blob:')) {
      return { level: 'low', reason: 'Dynamic script (data: or blob: URL)' };
    }
    return { level: 'medium', reason: 'Could not parse script URL' };
  }

  // Check for known compromised sources (highest priority)
  if (isCompromisedSource(domain)) {
    return {
      level: 'critical',
      reason: `CRITICAL: Known compromised source (${domain}). This CDN has been used in supply chain attacks. Remove immediately!`,
    };
  }

  const isFirstPartyScript = isFirstParty(domain, pageDomain);

  // First-party scripts
  if (isFirstPartyScript) {
    if (script.hasIntegrity) {
      return { level: 'safe', reason: 'First-party script with SRI verification' };
    }
    return {
      level: 'low',
      reason: `First-party script (${domain}) without SRI. Consider adding integrity attribute.`,
    };
  }

  // Third-party scripts
  if (!script.hasIntegrity) {
    if (isTrustedCDN(domain)) {
      return {
        level: 'medium',
        reason: `Third-party script from trusted CDN (${domain}) but missing SRI. Add integrity attribute for protection.`,
      };
    }
    return {
      level: 'high',
      reason: `Third-party script without SRI (${domain}). Vulnerable to CDN compromise or MITM attacks.`,
    };
  }

  // Has SRI
  if (isTrustedCDN(domain)) {
    return { level: 'safe', reason: `Trusted CDN (${domain}) with SRI verification` };
  }

  return { level: 'low', reason: `Third-party script with SRI from ${domain}` };
}

// Dynamic script loader patterns
interface LoaderPattern {
  name: string;
  type: DynamicLoaderInfo['type'];
  patterns: RegExp[];
  risk: 'high' | 'medium' | 'low';
  description: string;
}

const DYNAMIC_LOADER_PATTERNS: LoaderPattern[] = [
  {
    name: 'Google Tag Manager',
    type: 'tag_manager',
    patterns: [
      /googletagmanager\.com\/gtm\.js/i,
      /googletagmanager\.com\/gtag\/js/i,
      /GTM-[A-Z0-9]+/i,
    ],
    risk: 'high',
    description: 'Can dynamically inject unlimited third-party scripts. Each script loaded by GTM should be audited.',
  },
  {
    name: 'Google Analytics',
    type: 'analytics',
    patterns: [
      /google-analytics\.com\/analytics\.js/i,
      /google-analytics\.com\/ga\.js/i,
      /googletagmanager\.com\/gtag/i,
      /['"]UA-\d+-\d+['"]/i,
      /['"]G-[A-Z0-9]+['"]/i,
    ],
    risk: 'low',
    description: 'Analytics tracking script. Generally safe but sends data to Google.',
  },
  {
    name: 'Segment',
    type: 'tag_manager',
    patterns: [
      /cdn\.segment\.com/i,
      /segment\.io/i,
      /analytics\.js/i,
    ],
    risk: 'high',
    description: 'Customer data platform that can load multiple third-party integrations dynamically.',
  },
  {
    name: 'Adobe Launch/DTM',
    type: 'tag_manager',
    patterns: [
      /assets\.adobedtm\.com/i,
      /launch-[a-z0-9]+\.adobelaunch\.com/i,
      /_satellite/i,
    ],
    risk: 'high',
    description: 'Adobe tag manager that dynamically loads scripts. Audit all rules and extensions.',
  },
  {
    name: 'Tealium',
    type: 'tag_manager',
    patterns: [
      /tags\.tiqcdn\.com/i,
      /tealiumiq\.com/i,
      /utag\.js/i,
    ],
    risk: 'high',
    description: 'Tag manager that can inject arbitrary scripts. Review all configured tags.',
  },
  {
    name: 'Facebook Pixel',
    type: 'advertising',
    patterns: [
      /connect\.facebook\.net.*fbevents\.js/i,
      /facebook\.net\/en_US\/fbevents/i,
      /fbq\s*\(\s*['"]init['"]/i,
    ],
    risk: 'medium',
    description: 'Facebook tracking pixel. Sends user behavior data to Meta.',
  },
  {
    name: 'Google Ads',
    type: 'advertising',
    patterns: [
      /googleadservices\.com\/pagead/i,
      /googlesyndication\.com/i,
      /googleads\.g\.doubleclick\.net/i,
    ],
    risk: 'medium',
    description: 'Google advertising scripts. May load additional tracking scripts.',
  },
  {
    name: 'HubSpot',
    type: 'widget',
    patterns: [
      /js\.hs-scripts\.com/i,
      /js\.hsforms\.net/i,
      /js\.hs-analytics\.net/i,
    ],
    risk: 'medium',
    description: 'HubSpot marketing platform. Loads forms, chat, and analytics.',
  },
  {
    name: 'Intercom',
    type: 'widget',
    patterns: [
      /widget\.intercom\.io/i,
      /js\.intercomcdn\.com/i,
      /Intercom\s*\(/i,
    ],
    risk: 'medium',
    description: 'Customer messaging widget. Loads chat and support functionality.',
  },
  {
    name: 'Hotjar',
    type: 'analytics',
    patterns: [
      /static\.hotjar\.com/i,
      /script\.hotjar\.com/i,
      /hj\s*\(\s*['"]init['"]/i,
    ],
    risk: 'medium',
    description: 'Session recording and heatmap tool. Records user interactions.',
  },
  {
    name: 'Optimizely',
    type: 'a_b_testing',
    patterns: [
      /cdn\.optimizely\.com/i,
      /optimizely\.com\/js/i,
    ],
    risk: 'medium',
    description: 'A/B testing platform. Can modify page content and load variants.',
  },
  {
    name: 'Google Optimize',
    type: 'a_b_testing',
    patterns: [
      /googleoptimize\.com/i,
      /optimize\.google\.com/i,
    ],
    risk: 'medium',
    description: 'Google A/B testing tool. Can modify page content dynamically.',
  },
  {
    name: 'Sentry',
    type: 'error_tracking',
    patterns: [
      /browser\.sentry-cdn\.com/i,
      /sentry\.io/i,
      /Sentry\.init/i,
    ],
    risk: 'low',
    description: 'Error tracking service. Captures and reports JavaScript errors.',
  },
  {
    name: 'Datadog RUM',
    type: 'analytics',
    patterns: [
      /datadog-rum/i,
      /datadoghq\.com/i,
    ],
    risk: 'low',
    description: 'Real user monitoring. Tracks performance and user sessions.',
  },
  {
    name: 'Mixpanel',
    type: 'analytics',
    patterns: [
      /cdn\.mxpnl\.com/i,
      /mixpanel\.com\/track/i,
    ],
    risk: 'low',
    description: 'Product analytics platform. Tracks user events and behavior.',
  },
  {
    name: 'Amplitude',
    type: 'analytics',
    patterns: [
      /cdn\.amplitude\.com/i,
      /amplitude\.com/i,
    ],
    risk: 'low',
    description: 'Product analytics platform. Tracks user behavior and events.',
  },
  {
    name: 'Cloudflare',
    type: 'cdn',
    patterns: [
      /cdnjs\.cloudflare\.com/i,
      /cloudflare\.com\/ajax/i,
      /challenges\.cloudflare\.com/i,
    ],
    risk: 'low',
    description: 'Cloudflare CDN or security scripts. Generally trusted.',
  },
  {
    name: 'Stripe',
    type: 'widget',
    patterns: [
      /js\.stripe\.com/i,
      /checkout\.stripe\.com/i,
    ],
    risk: 'low',
    description: 'Payment processing scripts. Required for Stripe payments.',
  },
  {
    name: 'reCAPTCHA',
    type: 'widget',
    patterns: [
      /google\.com\/recaptcha/i,
      /gstatic\.com\/recaptcha/i,
    ],
    risk: 'low',
    description: 'Google reCAPTCHA for bot protection.',
  },
  {
    name: 'Drift',
    type: 'widget',
    patterns: [
      /js\.driftt\.com/i,
      /drift\.com/i,
    ],
    risk: 'medium',
    description: 'Conversational marketing platform. Loads chat widget.',
  },
  {
    name: 'Zendesk',
    type: 'widget',
    patterns: [
      /static\.zdassets\.com/i,
      /zendesk\.com\/embeddable/i,
    ],
    risk: 'low',
    description: 'Customer support widget. Loads help center and chat.',
  },
  {
    name: 'Crisp',
    type: 'widget',
    patterns: [
      /client\.crisp\.chat/i,
      /crisp\.chat/i,
    ],
    risk: 'low',
    description: 'Customer messaging platform. Loads chat widget.',
  },
  {
    name: 'LinkedIn Insight',
    type: 'advertising',
    patterns: [
      /snap\.licdn\.com/i,
      /linkedin\.com\/insight/i,
    ],
    risk: 'medium',
    description: 'LinkedIn tracking for advertising and analytics.',
  },
  {
    name: 'Twitter/X Pixel',
    type: 'advertising',
    patterns: [
      /static\.ads-twitter\.com/i,
      /analytics\.twitter\.com/i,
      /platform\.twitter\.com\/widgets/i,
    ],
    risk: 'medium',
    description: 'Twitter/X tracking pixel and widgets.',
  },
  {
    name: 'TikTok Pixel',
    type: 'advertising',
    patterns: [
      /analytics\.tiktok\.com/i,
      /tiktok\.com\/i18n/i,
    ],
    risk: 'medium',
    description: 'TikTok advertising pixel. Tracks conversions.',
  },
  {
    name: 'Pinterest Tag',
    type: 'advertising',
    patterns: [
      /pintrk/i,
      /s\.pinimg\.com\/ct/i,
    ],
    risk: 'medium',
    description: 'Pinterest conversion tracking tag.',
  },
  {
    name: 'Clarity',
    type: 'analytics',
    patterns: [
      /clarity\.ms/i,
      /microsoft\.com\/clarity/i,
    ],
    risk: 'low',
    description: 'Microsoft Clarity session recording and heatmaps.',
  },
];

function detectDynamicLoaders(html: string, scripts: ScriptInfo[]): DynamicLoaderInfo[] {
  const detected: DynamicLoaderInfo[] = [];
  const seenNames = new Set<string>();

  // Combine all script sources and inline content for pattern matching
  const allContent = html + scripts.map((s) => s.src || '').join(' ');

  for (const loader of DYNAMIC_LOADER_PATTERNS) {
    for (const pattern of loader.patterns) {
      if (pattern.test(allContent) && !seenNames.has(loader.name)) {
        seenNames.add(loader.name);

        // Try to find the actual script source
        const matchingScript = scripts.find(
          (s) => s.src && loader.patterns.some((p) => p.test(s.src))
        );

        detected.push({
          name: loader.name,
          type: loader.type,
          detected: true,
          scriptSrc: matchingScript?.src,
          risk: loader.risk,
          description: loader.description,
        });
        break;
      }
    }
  }

  return detected;
}

function generateWarnings(
  scripts: ScriptInfo[],
  dynamicLoaders: DynamicLoaderInfo[]
): string[] {
  const warnings: string[] = [];

  // Tag manager warning
  const tagManagers = dynamicLoaders.filter((l) => l.type === 'tag_manager');
  if (tagManagers.length > 0) {
    warnings.push(
      `⚠️ ${tagManagers.length} tag manager(s) detected (${tagManagers.map((t) => t.name).join(', ')}). ` +
        `These can dynamically load additional scripts not visible in this scan. ` +
        `Review your tag manager configuration for a complete security audit.`
    );
  }

  // A/B testing warning
  const abTesting = dynamicLoaders.filter((l) => l.type === 'a_b_testing');
  if (abTesting.length > 0) {
    warnings.push(
      `⚠️ A/B testing tool detected (${abTesting.map((t) => t.name).join(', ')}). ` +
        `These tools can modify page content and may load additional scripts for experiments.`
    );
  }

  // High-risk dynamic loaders
  const highRiskLoaders = dynamicLoaders.filter((l) => l.risk === 'high');
  if (highRiskLoaders.length > 0 && tagManagers.length === 0) {
    warnings.push(
      `⚠️ ${highRiskLoaders.length} high-risk dynamic loader(s) detected that can inject additional scripts.`
    );
  }

  // Many third-party scripts warning
  const thirdPartyCount = scripts.filter((s) => s.isExternal && !s.isFirstParty).length;
  if (thirdPartyCount > 10) {
    warnings.push(
      `⚠️ ${thirdPartyCount} third-party scripts detected. Consider reducing dependencies to minimize attack surface.`
    );
  }

  // No external scripts but has dynamic loaders
  const externalCount = scripts.filter((s) => s.isExternal).length;
  if (externalCount === 0 && dynamicLoaders.length > 0) {
    warnings.push(
      `⚠️ No external scripts in initial HTML, but dynamic loaders detected. ` +
        `Scripts may be loaded after page initialization.`
    );
  }

  return warnings;
}

export function parseScripts(html: string, baseUrl: string): ScriptInfo[] {
  const $ = cheerio.load(html);
  const scripts: ScriptInfo[] = [];
  const pageDomain = getDomain(baseUrl) || '';

  $('script').each((_, element) => {
    const $el = $(element);
    const src = $el.attr('src');
    const integrity = $el.attr('integrity');
    const crossorigin = $el.attr('crossorigin');

    const isExternal = !!src;
    const isInline = !src;

    let fullSrc = src || '';
    if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('blob:')) {
      try {
        fullSrc = new URL(src, baseUrl).href;
      } catch {
        fullSrc = src;
      }
    }

    const domain = isExternal ? getDomain(fullSrc) : undefined;
    const hasIntegrity = !!integrity;
    const isFirstPartyScript = domain ? isFirstParty(domain, pageDomain) : false;

    const scriptInfo: Partial<ScriptInfo> = {
      src: fullSrc,
      hasIntegrity,
      integrity,
      crossorigin,
      isExternal,
      isInline,
      isFirstParty: isFirstPartyScript,
      domain,
    };

    const { level, reason } = assessRisk({ script: scriptInfo, pageDomain });

    scripts.push({
      ...scriptInfo,
      riskLevel: level,
      riskReason: reason,
    } as ScriptInfo);
  });

  return scripts;
}

export function calculateOverallRisk(scripts: ScriptInfo[]): ScanResult['overallRisk'] {
  const externalScripts = scripts.filter((s) => s.isExternal);

  if (externalScripts.length === 0) {
    return 'safe';
  }

  if (externalScripts.some((s) => s.riskLevel === 'critical')) {
    return 'critical';
  }

  if (externalScripts.some((s) => s.riskLevel === 'high')) {
    return 'high';
  }

  if (externalScripts.some((s) => s.riskLevel === 'medium')) {
    return 'medium';
  }

  if (externalScripts.some((s) => s.riskLevel === 'low')) {
    return 'low';
  }

  return 'safe';
}

function generateRecommendations(
  scripts: ScriptInfo[],
  dynamicLoaders: DynamicLoaderInfo[]
): string[] {
  const recommendations: string[] = [];

  const criticalScripts = scripts.filter((s) => s.riskLevel === 'critical');
  const highRiskScripts = scripts.filter((s) => s.riskLevel === 'high');
  const mediumRiskScripts = scripts.filter((s) => s.riskLevel === 'medium');
  const scriptsWithoutSRI = scripts.filter((s) => s.isExternal && !s.hasIntegrity);
  const thirdPartyWithoutSRI = scriptsWithoutSRI.filter((s) => !s.isFirstParty);

  // Critical: Compromised sources
  if (criticalScripts.length > 0) {
    recommendations.push(
      `🚨 URGENT: Remove ${criticalScripts.length} script(s) from known compromised sources immediately.`
    );
  }

  // High risk: Third-party without SRI
  if (highRiskScripts.length > 0) {
    recommendations.push(
      `Add SRI attributes to ${highRiskScripts.length} high-risk third-party script(s) to prevent supply chain attacks.`
    );
  }

  // Medium risk: Trusted CDN without SRI
  if (mediumRiskScripts.length > 0) {
    recommendations.push(
      `Consider adding SRI to ${mediumRiskScripts.length} script(s) from trusted CDNs for additional protection.`
    );
  }

  // Tag managers recommendation
  const tagManagers = dynamicLoaders.filter((l) => l.type === 'tag_manager');
  if (tagManagers.length > 0) {
    recommendations.push(
      `Audit your tag manager (${tagManagers.map((t) => t.name).join(', ')}) configuration. ` +
        `Each tag can load additional scripts not covered by this scan.`
    );
  }

  // Tool for generating SRI
  if (thirdPartyWithoutSRI.length > 0) {
    recommendations.push(
      `Use VerifyFetch to generate SRI hashes: npx @verifyfetch/cli sign <script-urls>`
    );
  }

  // Advertising scripts recommendation
  const adScripts = dynamicLoaders.filter((l) => l.type === 'advertising');
  if (adScripts.length > 3) {
    recommendations.push(
      `Consider consolidating ${adScripts.length} advertising/tracking scripts to reduce page load time and attack surface.`
    );
  }

  // Success message
  if (
    recommendations.length === 0 ||
    (criticalScripts.length === 0 &&
      highRiskScripts.length === 0 &&
      mediumRiskScripts.length === 0 &&
      tagManagers.length === 0)
  ) {
    if (recommendations.length === 0) {
      recommendations.push('✅ Great job! All scripts appear to be properly secured.');
    } else {
      recommendations.unshift('✅ No critical script vulnerabilities detected in initial HTML.');
    }
  }

  return recommendations;
}

export function generateScanResult(html: string, url: string): ScanResult {
  const scripts = parseScripts(html, url);
  const externalScripts = scripts.filter((s) => s.isExternal);
  const inlineScripts = scripts.filter((s) => s.isInline);
  const firstPartyScripts = externalScripts.filter((s) => s.isFirstParty);
  const thirdPartyScripts = externalScripts.filter((s) => !s.isFirstParty);
  const vulnerableScripts = externalScripts.filter(
    (s) => s.riskLevel === 'critical' || s.riskLevel === 'high'
  );

  // Detect dynamic script loaders
  const dynamicLoaders = detectDynamicLoaders(html, scripts);
  const warnings = generateWarnings(scripts, dynamicLoaders);

  // Adjust overall risk based on dynamic loaders
  let overallRisk = calculateOverallRisk(scripts);

  // Elevate risk if high-risk tag managers are present but no critical/high issues found
  if (
    overallRisk === 'safe' ||
    overallRisk === 'low'
  ) {
    const hasHighRiskLoader = dynamicLoaders.some(
      (l) => l.risk === 'high' && l.type === 'tag_manager'
    );
    if (hasHighRiskLoader) {
      overallRisk = 'medium';
    }
  }

  return {
    url,
    scannedAt: new Date().toISOString(),
    totalScripts: scripts.length,
    externalScripts: externalScripts.length,
    inlineScripts: inlineScripts.length,
    firstPartyScripts: firstPartyScripts.length,
    thirdPartyScripts: thirdPartyScripts.length,
    vulnerableScripts: vulnerableScripts.length,
    overallRisk,
    scripts,
    dynamicLoaders,
    warnings,
    recommendations: generateRecommendations(scripts, dynamicLoaders),
  };
}
