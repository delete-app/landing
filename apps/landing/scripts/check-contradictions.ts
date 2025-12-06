/**
 * Contradiction & Hypocrisy Detection Agent
 *
 * Uses winkNLP for semantic analysis to detect:
 * - Internal contradictions within articles
 * - Cross-article contradictions between modules
 * - Research conflicts (when cited studies disagree)
 * - Advice contradictions (when we recommend opposing actions)
 * - Tone/framing inconsistencies
 *
 * Outputs notes only - does not make corrections.
 *
 * Usage:
 *   npx tsx scripts/check-contradictions.ts [--module <n>] [--verbose]
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, relative, basename } from 'path';
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

// Initialize winkNLP
const nlp = winkNLP(model);
const its = nlp.its;
const as = nlp.as;

interface Article {
  path: string;
  module: string;
  title: string;
  content: string;
  sentences: ParsedSentence[];
  claims: Claim[];
  advice: Advice[];
  citations: Citation[];
}

interface ParsedSentence {
  text: string;
  line: number;
  tokens: string[];
  lemmas: string[];
  entities: string[];
  isQuestion: boolean;
  isNegated: boolean;
}

interface Claim {
  text: string;
  line: number;
  context: string;
  sentence: ParsedSentence;
}

interface Advice {
  text: string;
  line: number;
  type: 'do' | 'dont' | 'consider';
  sentence: ParsedSentence;
}

interface Citation {
  number: number;
  authors: string;
  year: string;
  finding: string;
}

interface ContradictionNote {
  type: 'internal' | 'cross-article' | 'research-conflict' | 'advice-conflict' | 'tone';
  severity: 'info' | 'warning' | 'review';
  article1: string;
  article2?: string;
  claim1: string;
  claim2?: string;
  note: string;
  suggestion?: string;
}

const CONTENT_DIR = join(import.meta.dirname, '../src/content/docs/learn');

// Semantic similarity threshold (0-1, higher = more similar)
const SIMILARITY_THRESHOLD = 0.65;

// Negation words that flip meaning
const NEGATION_WORDS = new Set([
  'not', "n't", 'never', 'no', 'none', 'neither', 'nobody', 'nothing',
  'nowhere', 'hardly', 'barely', 'scarcely', "don't", "doesn't", "didn't",
  "won't", "wouldn't", "couldn't", "shouldn't", "can't", "cannot"
]);

// Modal verbs that indicate advice
const MODAL_DO = new Set(['should', 'must', 'need', 'try', 'practice', 'focus', 'consider']);
const MODAL_DONT = new Set(["shouldn't", "mustn't", 'avoid', 'stop', "don't", "never"]);

// Topics that commonly have nuanced or seemingly contradictory advice
const TENSION_TOPICS = [
  {
    topic: 'vulnerability',
    keywords: ['vulnerable', 'vulnerability', 'open up', 'share', 'disclose'],
    tension: 'When to be vulnerable vs. when to protect yourself'
  },
  {
    topic: 'attachment',
    keywords: ['anxious', 'avoidant', 'secure', 'attachment'],
    tension: 'Attachment styles as fixed vs. changeable'
  },
  {
    topic: 'communication',
    keywords: ['communicate', 'talk', 'discuss', 'express', 'share feelings'],
    tension: 'Communicating everything vs. strategic disclosure'
  },
  {
    topic: 'compatibility',
    keywords: ['compatible', 'compatibility', 'similar', 'different', 'opposites'],
    tension: 'Similarity vs. complementarity in partners'
  },
  {
    topic: 'effort',
    keywords: ['effort', 'work', 'try', 'invest', 'commit'],
    tension: 'Relationships require work vs. it shouldn\'t be this hard'
  },
  {
    topic: 'authenticity',
    keywords: ['authentic', 'genuine', 'real', 'yourself', 'pretend'],
    tension: 'Being yourself vs. growth and change'
  },
  {
    topic: 'timing',
    keywords: ['wait', 'soon', 'early', 'later', 'timing', 'ready'],
    tension: 'When to act vs. when to wait'
  },
  {
    topic: 'standards',
    keywords: ['standards', 'expectations', 'dealbreaker', 'compromise', 'settle'],
    tension: 'High standards vs. realistic expectations'
  },
];

function getAllMarkdownFiles(dir: string, moduleFilter?: string): string[] {
  const files: string[] = [];

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (moduleFilter && entry.name.startsWith('module-')) {
        const moduleNum = entry.name.match(/module-(\d+)/)?.[1];
        if (moduleNum !== moduleFilter) continue;
      }
      files.push(...getAllMarkdownFiles(fullPath, moduleFilter));
    } else if (entry.name.endsWith('.md') && !entry.name.includes('index')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseSentences(content: string): ParsedSentence[] {
  const sentences: ParsedSentence[] = [];
  const lines = content.split('\n');

  // Track line numbers for each character position
  const lineMap: number[] = [];
  let currentLine = 0;
  for (let i = 0; i < content.length; i++) {
    lineMap.push(currentLine);
    if (content[i] === '\n') currentLine++;
  }

  const doc = nlp.readDoc(content);

  doc.sentences().each((sentence) => {
    const text = sentence.out();
    const startPos = content.indexOf(text);
    const lineNum = startPos >= 0 ? lineMap[startPos] + 1 : 0;

    // Skip markdown headers and code blocks
    if (text.startsWith('#') || text.startsWith('```')) return;

    const tokens = sentence.tokens().out(its.normal) as string[];
    const lemmas = sentence.tokens().out(its.lemma) as string[];
    const entities = sentence.entities().out(its.value) as string[];

    // Check if sentence is a question
    const isQuestion = text.trim().endsWith('?');

    // Check if sentence contains negation
    const isNegated = tokens.some(t => NEGATION_WORDS.has(t.toLowerCase()));

    sentences.push({
      text: text.trim(),
      line: lineNum,
      tokens,
      lemmas,
      entities,
      isQuestion,
      isNegated,
    });
  });

  return sentences;
}

function computeJaccardSimilarity(set1: string[], set2: string[]): number {
  const s1 = new Set(set1.map(s => s.toLowerCase()));
  const s2 = new Set(set2.map(s => s.toLowerCase()));

  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

function computeSemanticSimilarity(sent1: ParsedSentence, sent2: ParsedSentence): number {
  // Use lemmas for semantic similarity (reduces inflection differences)
  const lemmaScore = computeJaccardSimilarity(sent1.lemmas, sent2.lemmas);

  // Boost for shared entities (proper nouns, technical terms)
  const entityScore = computeJaccardSimilarity(sent1.entities, sent2.entities);

  // Combined score (weight lemmas more heavily)
  return lemmaScore * 0.7 + entityScore * 0.3;
}

function extractClaims(content: string, sentences: ParsedSentence[]): Claim[] {
  const claims: Claim[] = [];

  // Patterns that indicate research claims
  const claimPatterns = [
    /research\s+(shows?|finds?|suggests?|indicates?|demonstrates?)/i,
    /stud(y|ies)\s+(show|find|suggest|indicate|demonstrate)/i,
    /evidence\s+(shows?|suggests?|indicates?)/i,
    /\b(more|less)\s+likely\s+to\b/i,
    /predicts?\s+(better|worse|higher|lower)/i,
    /\d+%/i, // Statistics
  ];

  for (const sentence of sentences) {
    if (sentence.isQuestion) continue; // Skip questions

    for (const pattern of claimPatterns) {
      if (pattern.test(sentence.text)) {
        claims.push({
          text: sentence.text,
          line: sentence.line,
          context: sentence.text.slice(0, 200),
          sentence,
        });
        break;
      }
    }
  }

  return claims;
}

function extractAdvice(sentences: ParsedSentence[]): Advice[] {
  const advice: Advice[] = [];

  for (const sentence of sentences) {
    // Skip questions and conditional statements (rhetorical advice)
    if (sentence.isQuestion) continue;
    if (/^if\s+/i.test(sentence.text)) continue;
    if (/\bhow\s+(do|would|could)\s+you/i.test(sentence.text)) continue;

    // Check for "you don't have to" / "you don't need to" (permission, not prohibition)
    if (/you\s+(don't|do not)\s+(have|need)\s+to/i.test(sentence.text)) continue;

    const lowerText = sentence.text.toLowerCase();
    const hasNegation = sentence.isNegated;

    // Check for DO advice (positive recommendations)
    const hasDo = sentence.tokens.some(t => MODAL_DO.has(t.toLowerCase()));
    // Check for DON'T advice (prohibitions)
    const hasDont = sentence.tokens.some(t => MODAL_DONT.has(t.toLowerCase()));

    if (hasDont || (hasDo && hasNegation)) {
      advice.push({
        text: sentence.text.slice(0, 100),
        line: sentence.line,
        type: 'dont',
        sentence,
      });
    } else if (hasDo && !hasNegation) {
      advice.push({
        text: sentence.text.slice(0, 100),
        line: sentence.line,
        type: 'do',
        sentence,
      });
    }
  }

  return advice;
}

function extractCitations(content: string): Citation[] {
  const citations: Citation[] = [];
  const refSection = content.match(/## References\n([\s\S]*?)$/);

  if (!refSection) return citations;

  const refs = refSection[1].matchAll(/(\d+)\.\s+([^(]+)\((\d{4})\)[^.]+\.\s*([^<\n]+)/g);

  for (const match of refs) {
    citations.push({
      number: parseInt(match[1]),
      authors: match[2].trim(),
      year: match[3],
      finding: match[4].trim(),
    });
  }

  return citations;
}

function loadArticles(moduleFilter?: string): Article[] {
  const files = getAllMarkdownFiles(CONTENT_DIR, moduleFilter);
  const articles: Article[] = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    const relativePath = relative(CONTENT_DIR, filePath);
    const moduleMatch = relativePath.match(/module-(\d+)-([^/]+)/);

    const titleMatch = content.match(/title:\s*["']?([^"'\n]+)["']?/);
    const title = titleMatch ? titleMatch[1] : basename(filePath, '.md');

    const sentences = parseSentences(content);

    articles.push({
      path: relativePath,
      module: moduleMatch ? `Module ${moduleMatch[1]}` : 'Unknown',
      title,
      content,
      sentences,
      claims: extractClaims(content, sentences),
      advice: extractAdvice(sentences),
      citations: extractCitations(content),
    });
  }

  return articles.sort((a, b) => a.path.localeCompare(b.path));
}

function findTensionPoints(articles: Article[]): ContradictionNote[] {
  const notes: ContradictionNote[] = [];

  for (const tension of TENSION_TOPICS) {
    const relevantArticles: { article: Article; mentions: string[] }[] = [];

    for (const article of articles) {
      const mentions: string[] = [];
      const lowerContent = article.content.toLowerCase();

      for (const keyword of tension.keywords) {
        if (lowerContent.includes(keyword)) {
          for (const sentence of article.sentences) {
            if (sentence.text.toLowerCase().includes(keyword) && sentence.text.length > 20) {
              mentions.push(sentence.text.slice(0, 150));
            }
          }
        }
      }

      if (mentions.length > 0) {
        relevantArticles.push({ article, mentions: [...new Set(mentions)].slice(0, 3) });
      }
    }

    if (relevantArticles.length >= 2) {
      notes.push({
        type: 'cross-article',
        severity: 'info',
        article1: relevantArticles.map(r => r.article.title).join(', '),
        claim1: relevantArticles.flatMap(r => r.mentions).slice(0, 2).join(' | '),
        note: `Topic "${tension.topic}" appears across ${relevantArticles.length} articles. Known tension: ${tension.tension}`,
        suggestion: 'Review for consistent framing and acknowledge nuance where appropriate.',
      });
    }
  }

  return notes;
}

function findAbsoluteStatements(articles: Article[]): ContradictionNote[] {
  const notes: ContradictionNote[] = [];
  const absolutePatterns = [
    /\balways\b/gi,
    /\bnever\b/gi,
    /\beveryone\b/gi,
    /\bno one\b/gi,
    /\ball\s+(people|relationships|couples)\b/gi,
    /\bthe only\b/gi,
    /\bguaranteed\b/gi,
  ];

  for (const article of articles) {
    for (const sentence of article.sentences) {
      // Skip questions, quotes, and hedged statements
      if (sentence.isQuestion) continue;
      if (/^["']/.test(sentence.text)) continue;
      if (/not always|almost never|rarely|sometimes/i.test(sentence.text)) continue;

      for (const pattern of absolutePatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(sentence.text) && sentence.text.length > 30) {
          notes.push({
            type: 'internal',
            severity: 'info',
            article1: article.title,
            claim1: sentence.text.slice(0, 150),
            note: `Absolute statement found (line ${sentence.line}). Research rarely supports absolutes.`,
            suggestion: 'Consider softening language or adding nuance.',
          });
        }
      }
    }
  }

  return notes;
}

function findConflictingAdvice(articles: Article[]): ContradictionNote[] {
  const notes: ContradictionNote[] = [];

  // Collect all advice across articles
  const allAdvice: { article: Article; advice: Advice }[] = [];
  for (const article of articles) {
    for (const adv of article.advice) {
      allAdvice.push({ article, advice: adv });
    }
  }

  // Find semantically similar advice with opposing polarities
  const checked = new Set<string>();

  for (const a1 of allAdvice) {
    for (const a2 of allAdvice) {
      if (a1 === a2) continue;
      if (a1.article.path === a2.article.path) continue; // Same article

      const key = [a1.advice.text, a2.advice.text].sort().join('|||');
      if (checked.has(key)) continue;
      checked.add(key);

      // Only compare DO vs DON'T
      if (a1.advice.type === a2.advice.type) continue;

      // Compute semantic similarity
      const similarity = computeSemanticSimilarity(a1.advice.sentence, a2.advice.sentence);

      if (similarity >= SIMILARITY_THRESHOLD) {
        notes.push({
          type: 'advice-conflict',
          severity: 'warning',
          article1: a1.article.title,
          article2: a2.article.title,
          claim1: `${a1.advice.type.toUpperCase()}: ${a1.advice.text}`,
          claim2: `${a2.advice.type.toUpperCase()}: ${a2.advice.text}`,
          note: `Semantically similar advice with opposing polarity (similarity: ${(similarity * 100).toFixed(0)}%).`,
          suggestion: 'Review if both pieces of advice are contextually appropriate and clearly differentiated.',
        });
      }
    }
  }

  return notes;
}

function findResearchConflicts(articles: Article[]): ContradictionNote[] {
  const notes: ContradictionNote[] = [];

  // Collect all claims across articles
  const allClaims: { article: Article; claim: Claim }[] = [];
  for (const article of articles) {
    for (const claim of article.claims) {
      allClaims.push({ article, claim });
    }
  }

  // Find semantically similar claims with opposing implications
  const checked = new Set<string>();

  for (const c1 of allClaims) {
    for (const c2 of allClaims) {
      if (c1 === c2) continue;
      if (c1.article.path === c2.article.path) continue;

      const key = [c1.claim.text, c2.claim.text].sort().join('|||');
      if (checked.has(key)) continue;
      checked.add(key);

      // Check for semantic similarity
      const similarity = computeSemanticSimilarity(c1.claim.sentence, c2.claim.sentence);

      if (similarity >= SIMILARITY_THRESHOLD) {
        // Check for opposing directional language
        const hasOpposingPolarity =
          (c1.claim.sentence.isNegated !== c2.claim.sentence.isNegated) ||
          (/higher|better|more|increase|improve|positive/i.test(c1.claim.text) &&
            /lower|worse|less|decrease|harm|negative/i.test(c2.claim.text)) ||
          (/lower|worse|less|decrease|harm|negative/i.test(c1.claim.text) &&
            /higher|better|more|increase|improve|positive/i.test(c2.claim.text));

        if (hasOpposingPolarity) {
          notes.push({
            type: 'research-conflict',
            severity: 'review',
            article1: c1.article.title,
            article2: c2.article.title,
            claim1: c1.claim.text.slice(0, 100),
            claim2: c2.claim.text.slice(0, 100),
            note: `Semantically similar research claims with opposing implications (similarity: ${(similarity * 100).toFixed(0)}%).`,
            suggestion: 'Verify both studies are accurately represented and differences are explained.',
          });
        }
      }
    }
  }

  return notes;
}

function generateReport(notes: ContradictionNote[], articles: Article[]): string {
  const lines: string[] = [];

  lines.push('# Contradiction & Consistency Review Notes');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Articles analyzed: ${articles.length}`);
  lines.push(`Total notes: ${notes.length}`);
  lines.push('');
  lines.push('*Using winkNLP for semantic analysis*');
  lines.push('');
  lines.push('---');
  lines.push('');

  const byType: Record<string, ContradictionNote[]> = {};
  for (const note of notes) {
    if (!byType[note.type]) {
      byType[note.type] = [];
    }
    byType[note.type].push(note);
  }

  const typeLabels: Record<string, string> = {
    'research-conflict': '## Research Conflicts (Requires Review)',
    'advice-conflict': '## Advice Conflicts',
    'cross-article': '## Cross-Article Tensions',
    'internal': '## Internal Consistency Notes',
    'tone': '## Tone/Framing Notes',
  };

  for (const [type, label] of Object.entries(typeLabels)) {
    const typeNotes = byType[type] || [];
    if (typeNotes.length === 0) continue;

    lines.push(label);
    lines.push('');

    for (const note of typeNotes) {
      lines.push(`### ${note.article1}${note.article2 ? ` ↔ ${note.article2}` : ''}`);
      lines.push('');
      lines.push(`**Severity:** ${note.severity}`);
      lines.push('');
      lines.push(`**Note:** ${note.note}`);
      lines.push('');
      if (note.claim1) {
        lines.push(`**Claim 1:** "${note.claim1}"`);
        lines.push('');
      }
      if (note.claim2) {
        lines.push(`**Claim 2:** "${note.claim2}"`);
        lines.push('');
      }
      if (note.suggestion) {
        lines.push(`**Suggestion:** ${note.suggestion}`);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }
  }

  lines.push('## Known Tensions (By Design)');
  lines.push('');
  lines.push('These are inherent complexities in relationship psychology that we intentionally navigate:');
  lines.push('');
  for (const tension of TENSION_TOPICS) {
    lines.push(`- **${tension.topic}**: ${tension.tension}`);
  }
  lines.push('');

  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const moduleIndex = args.indexOf('--module');
  const moduleFilter = moduleIndex !== -1 ? args[moduleIndex + 1] : undefined;

  console.log('🔍 Contradiction & Consistency Detection (winkNLP)');
  console.log('');

  const articles = loadArticles(moduleFilter);
  console.log(`Analyzing ${articles.length} articles...`);
  console.log('');

  const allNotes: ContradictionNote[] = [];

  console.log('  Checking for tension points...');
  allNotes.push(...findTensionPoints(articles));

  console.log('  Checking for absolute statements...');
  allNotes.push(...findAbsoluteStatements(articles));

  console.log('  Checking for conflicting advice (semantic)...');
  allNotes.push(...findConflictingAdvice(articles));

  console.log('  Checking for research conflicts (semantic)...');
  allNotes.push(...findResearchConflicts(articles));

  console.log('');

  const report = generateReport(allNotes, articles);
  const outputPath = join(import.meta.dirname, '../contradiction-notes.md');
  writeFileSync(outputPath, report);

  const bySeverity = {
    review: allNotes.filter(n => n.severity === 'review').length,
    warning: allNotes.filter(n => n.severity === 'warning').length,
    info: allNotes.filter(n => n.severity === 'info').length,
  };

  console.log('==================================================');
  console.log('📊 Summary');
  console.log('==================================================');
  console.log(`   Articles analyzed: ${articles.length}`);
  console.log(`   Total notes: ${allNotes.length}`);
  console.log(`   - Requires review: ${bySeverity.review}`);
  console.log(`   - Warnings: ${bySeverity.warning}`);
  console.log(`   - Info: ${bySeverity.info}`);
  console.log('');
  console.log(`📝 Full report saved to: ${outputPath}`);

  if (verbose) {
    console.log('');
    console.log('--- FULL REPORT ---');
    console.log(report);
  }
}

main();
