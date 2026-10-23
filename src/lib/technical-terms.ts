type TechnicalTermRule = {
  canonical: string;
  patterns: RegExp[];
};

const technicalTermRules: TechnicalTermRule[] = [
  {
    canonical: "Lovable",
    patterns: [
      /\blovable\b/gi,
      /\blove\s*able\b/gi,
      /\blove\s*ball\b/gi,
      /\blovabel\b/gi,
      /\blovi\b/gi,
      /\blovy\b/gi,
      /\blouv(?:a|\u00e1)vel\b/gi,
    ],
  },
  {
    canonical: "TypeScript",
    patterns: [/\btype\s*script\b/gi, /\btypescript\b/gi],
  },
  {
    canonical: "JavaScript",
    patterns: [/\bjava\s*script\b/gi, /\bjavascript\b/gi],
  },
  {
    canonical: "Supabase",
    patterns: [/\bsupa\s*base\b/gi, /\bsupabase\b/gi, /\bsuper\s*base\b/gi, /\bsuperbase\b/gi],
  },
  {
    canonical: "Fireflies",
    patterns: [/\bfire\s*flies\b/gi, /\bfireflies\b/gi, /\bfireflys\b/gi, /\bfirefly\b/gi],
  },
  {
    canonical: "frontend",
    patterns: [/\bfront\s*end\b/gi, /\bfront-end\b/gi, /\bfrontend\b/gi, /\bfront\b/gi],
  },
  {
    canonical: "backend",
    patterns: [/\bback\s*end\b/gi, /\bback-end\b/gi, /\bbackend\b/gi, /\bback\b/gi],
  },
  {
    canonical: "full stack",
    patterns: [/\bfull\s*stack\b/gi, /\bfull-stack\b/gi, /\bfullstack\b/gi],
  },
  {
    canonical: "OpenAI",
    patterns: [/\bopen\s*ai\b/gi, /\bopenai\b/gi],
  },
  {
    canonical: "ChatGPT",
    patterns: [/\bchat\s*gpt\b/gi, /\bchatgpt\b/gi],
  },
  {
    canonical: "Next.js",
    patterns: [/\bnext\s*js\b/gi, /\bnextjs\b/gi],
  },
  {
    canonical: "Node.js",
    patterns: [/\bnode\s*js\b/gi, /\bnodejs\b/gi],
  },
  {
    canonical: "GitHub",
    patterns: [/\bgit\s*hub\b/gi, /\bgithub\b/gi],
  },
  {
    canonical: "PostgreSQL",
    patterns: [/\bpostgre\s*sql\b/gi, /\bpostgresql\b/gi, /\bpostgres\b/gi],
  },
  {
    canonical: "APIs",
    patterns: [/\ba\s*p\s*i\s*s\b/gi, /\bapis\b/gi],
  },
  {
    canonical: "API",
    patterns: [/\ba\s*p\s*i\b/gi, /\bapi\b/gi],
  },
  {
    canonical: "React",
    patterns: [/\breact\b/gi],
  },
  {
    canonical: "Vite",
    patterns: [/\bvite\b/gi],
  },
  {
    canonical: "Vercel",
    patterns: [/\bvercel\b/gi],
  },
  {
    canonical: "Firebase",
    patterns: [/\bfire\s*base\b/gi, /\bfirebase\b/gi],
  },
  {
    canonical: "Prisma",
    patterns: [/\bprisma\b/gi],
  },
  {
    canonical: "Tailwind",
    patterns: [/\btail\s*wind\b/gi, /\btailwind\b/gi],
  },
  {
    canonical: "Docker",
    patterns: [/\bdocker\b/gi, /\bdoquer\b/gi],
  },
  {
    canonical: "Figma",
    patterns: [/\bfigma\b/gi],
  },
  {
    canonical: "Stripe",
    patterns: [/\bstripe\b/gi, /\bestripe\b/gi],
  },
  {
    canonical: "Webhook",
    patterns: [/\bweb\s*hook\b/gi, /\bwebhook\b/gi],
  },
  {
    canonical: "endpoint",
    patterns: [/\bend\s*point\b/gi, /\bendpoint\b/gi],
  },
];

function testPattern(text: string, pattern: RegExp) {
  const regex = new RegExp(pattern.source, pattern.flags);
  return regex.test(text);
}

function countPatternMatches(text: string, pattern: RegExp) {
  const regex = new RegExp(pattern.source, pattern.flags);
  return text.match(regex)?.length ?? 0;
}

function normalizeLovableHeuristic(text: string) {
  if (!/\blove\b/i.test(text)) return text;
  if (!/(api|app|plataforma|produto|ferramenta|tool|site)\b/i.test(text)) {
    return text;
  }
  return text.replace(/\blove\b/gi, "Lovable");
}

export function normalizeTechnicalTerms(text: string) {
  const withLovable = normalizeLovableHeuristic(text);
  return technicalTermRules.reduce(
    (current, rule) =>
      rule.patterns.reduce((value, pattern) => value.replace(pattern, rule.canonical), current),
    withLovable,
  );
}

export function extractTechnicalTerms(text: string) {
  const matches = new Set<string>();
  for (const rule of technicalTermRules) {
    if (rule.patterns.some((pattern) => testPattern(text, pattern))) {
      matches.add(rule.canonical);
    }
  }
  return Array.from(matches);
}

export function scoreTechnicalTerms(text: string) {
  return technicalTermRules.reduce(
    (total, rule) =>
      total +
      rule.patterns.reduce((count, pattern) => count + countPatternMatches(text, pattern), 0),
    0,
  );
}
