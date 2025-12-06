#!/usr/bin/env npx tsx
/**
 * Fact Validation Script
 *
 * Extracts claims and their citations, then either:
 * 1. Generates prompts for manual Claude review (default)
 * 2. Outputs a JSON report for further processing
 *
 * Usage:
 *   npx tsx scripts/validate-facts.ts [file.md]        # Validate specific file
 *   npx tsx scripts/validate-facts.ts --all            # Validate all files
 *   npx tsx scripts/validate-facts.ts --changed        # Validate git-changed files
 *   npx tsx scripts/validate-facts.ts --json           # Output JSON for processing
 *   npx tsx scripts/validate-facts.ts --sample 5       # Only check N random citations
 *
 * For automated verification, pipe the output to Claude:
 *   npx tsx scripts/validate-facts.ts --json | claude "verify these claims"
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEARN_DIR = path.join(__dirname, "../src/content/docs/learn");
const APP_ROOT = path.join(__dirname, "..");

// Get git root dynamically to avoid path issues
function getGitRoot(): string {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      cwd: __dirname,
    }).trim();
  } catch {
    // Fallback to relative path
    return path.join(__dirname, "../..");
  }
}
const GIT_ROOT = getGitRoot();

// Types
interface Citation {
  claimText: string;
  citationNumber: number;
  lineNumber: number;
  file: string;
}

interface Reference {
  number: number;
  text: string;
  authors?: string;
  title?: string;
  year?: string;
  doi?: string;
  pubmedId?: string;
  link?: string;
}

interface ClaimToVerify {
  file: string;
  lineNumber: number;
  claim: string;
  reference: {
    number: number;
    citation: string;
    link?: string;
  };
}

// Simple recursive file finder
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

// Get git-changed markdown files
function getChangedFiles(base = "HEAD~1"): string[] {
  try {
    const output = execSync(`git diff --name-only ${base} HEAD`, {
      encoding: "utf-8",
      cwd: GIT_ROOT,
    });
    return output
      .split("\n")
      .filter((f) => f.endsWith(".md") && f.includes("learn/module-"))
      .map((f) => path.join(GIT_ROOT, f));
  } catch {
    return [];
  }
}

// Get changed line numbers from git diff for a specific file
function getChangedLineNumbers(filePath: string, base = "HEAD~1"): Set<number> {
  const changedLines = new Set<number>();
  try {
    // Get unified diff with line numbers
    const relativePath = path.relative(GIT_ROOT, filePath);
    const output = execSync(`git diff ${base} HEAD --unified=0 -- "${relativePath}"`, {
      encoding: "utf-8",
      cwd: GIT_ROOT,
    });

    // Parse diff output for added/modified lines
    // Format: @@ -old_start,old_count +new_start,new_count @@
    const hunkPattern = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g;
    let match;

    while ((match = hunkPattern.exec(output)) !== null) {
      const startLine = parseInt(match[1], 10);
      const lineCount = match[2] ? parseInt(match[2], 10) : 1;

      // Add all lines in this hunk
      for (let i = 0; i < lineCount; i++) {
        changedLines.add(startLine + i);
      }
    }
  } catch {
    // If diff fails (new file, etc.), return empty set
  }
  return changedLines;
}

// Get staged changes (for pre-commit hook)
function getStagedFiles(): string[] {
  try {
    const output = execSync("git diff --cached --name-only", {
      encoding: "utf-8",
      cwd: GIT_ROOT,
    });
    return output
      .split("\n")
      .filter((f) => f.endsWith(".md") && f.includes("learn/module-"))
      .map((f) => path.join(GIT_ROOT, f));
  } catch {
    return [];
  }
}

// Get staged line numbers for a file
function getStagedLineNumbers(filePath: string): Set<number> {
  const changedLines = new Set<number>();
  try {
    const relativePath = path.relative(GIT_ROOT, filePath);
    const output = execSync(`git diff --cached --unified=0 -- "${relativePath}"`, {
      encoding: "utf-8",
      cwd: GIT_ROOT,
    });

    const hunkPattern = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g;
    let match;

    while ((match = hunkPattern.exec(output)) !== null) {
      const startLine = parseInt(match[1], 10);
      const lineCount = match[2] ? parseInt(match[2], 10) : 1;

      for (let i = 0; i < lineCount; i++) {
        changedLines.add(startLine + i);
      }
    }
  } catch {
    // If diff fails, return empty set
  }
  return changedLines;
}

// Extract the claim context (sentence containing the citation)
function extractClaimContext(
  content: string,
  lineIndex: number,
  citationMatch: RegExpExecArray
): string {
  const lines = content.split("\n");
  const line = lines[lineIndex];

  // Get the position of the citation in the line
  const citationPos = citationMatch.index;

  // Find the sentence containing this citation
  // Look backwards for sentence start - but if citation is right after a period, include the previous sentence
  let start = 0;
  let foundSentenceEnd = false;
  for (let i = citationPos - 1; i >= 0; i--) {
    const char = line[i];
    // Skip whitespace and parentheses right before citation
    if (char === " " || char === "(" || char === ")") continue;

    if (char === "." || char === "!" || char === "?" || char === ":") {
      if (!foundSentenceEnd) {
        // This is the end of the sentence the citation refers to
        // Keep looking for the start
        foundSentenceEnd = true;
        continue;
      } else {
        // This is the start of our sentence
        start = i + 1;
        break;
      }
    }
  }

  // Look forwards for sentence end (after citation)
  let end = line.length;
  const afterCitation = citationPos + citationMatch[0].length;
  for (let i = afterCitation; i < line.length; i++) {
    if (line[i] === "." || line[i] === "!" || line[i] === "?") {
      end = i + 1;
      break;
    }
  }

  let claim = line.slice(start, end).trim();

  // If claim is too short, include previous lines
  if (claim.length < 60 && lineIndex > 0) {
    for (let j = lineIndex - 1; j >= Math.max(0, lineIndex - 3); j--) {
      const prevLine = lines[j].trim();
      if (prevLine && !prevLine.startsWith("#") && !prevLine.startsWith("-") && !prevLine.startsWith("|") && prevLine.length > 10) {
        claim = prevLine + " " + claim;
        if (claim.length >= 80) break;
      }
    }
  }

  // Clean up markdown
  claim = claim
    .replace(/<sup>\[\[\d+\]\]\(#references\)<\/sup>/g, " [citation]")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return claim;
}

// Extract citations from markdown content
// If changedLines is provided, only extract citations from those lines
function extractCitations(content: string, filePath: string, changedLines?: Set<number>): Citation[] {
  const citations: Citation[] = [];
  const lines = content.split("\n");
  const relativePath = path.relative(LEARN_DIR, filePath);

  // Match citations like <sup>[[1]](#references)</sup>
  const citationPattern = /<sup>\[\[(\d+)\]\]\(#references\)<\/sup>/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Skip lines in the references section
    if (line.match(/^##\s*References/i)) break;

    // If filtering by changed lines, skip unchanged lines
    if (changedLines && changedLines.size > 0 && !changedLines.has(lineNumber)) {
      continue;
    }

    let match;
    // Reset regex lastIndex for each line
    citationPattern.lastIndex = 0;

    while ((match = citationPattern.exec(line)) !== null) {
      const citationNumber = parseInt(match[1], 10);
      const claimText = extractClaimContext(content, i, match);

      citations.push({
        claimText,
        citationNumber,
        lineNumber,
        file: relativePath,
      });
    }
  }

  return citations;
}

// Extract references from markdown content
function extractReferences(content: string): Reference[] {
  const references: Reference[] = [];

  // Find the references section
  const refSectionMatch = content.match(
    /## References\s*\n([\s\S]*?)(?=\n## |$)/i
  );
  if (!refSectionMatch) return references;

  const refSection = refSectionMatch[1];
  const refLines = refSection.split("\n");

  // Match numbered references
  const refPattern = /^(\d+)\.\s+(.+)$/;

  for (const line of refLines) {
    const match = line.match(refPattern);
    if (match) {
      const number = parseInt(match[1], 10);
      const text = match[2];

      // Extract DOI
      const doiMatch = text.match(/doi[.:]?\s*([^\s"<>]+)/i);
      const doi = doiMatch ? doiMatch[1] : undefined;

      // Extract PubMed ID
      const pubmedMatch = text.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
      const pubmedId = pubmedMatch ? pubmedMatch[1] : undefined;

      // Extract any link
      const linkMatch = text.match(/href="([^"]+)"/);
      const link = linkMatch ? linkMatch[1] : undefined;

      // Try to extract year
      const yearMatch = text.match(/\((\d{4})\)/);
      const year = yearMatch ? yearMatch[1] : undefined;

      references.push({ number, text, doi, pubmedId, link, year });
    }
  }

  return references;
}

// Process a single file
// If changedLines is provided, only extract citations from those lines
function processFile(filePath: string, changedLines?: Set<number>): ClaimToVerify[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const citations = extractCitations(content, filePath, changedLines);
  const references = extractReferences(content);
  const claims: ClaimToVerify[] = [];

  // Deduplicate by reference number (keep first occurrence)
  const seenRefs = new Set<number>();

  for (const citation of citations) {
    if (seenRefs.has(citation.citationNumber)) continue;
    seenRefs.add(citation.citationNumber);

    const ref = references.find((r) => r.number === citation.citationNumber);
    if (!ref) continue;

    claims.push({
      file: citation.file,
      lineNumber: citation.lineNumber,
      claim: citation.claimText,
      reference: {
        number: ref.number,
        citation: ref.text.replace(/<[^>]+>/g, "").slice(0, 200),
        link: ref.link || (ref.doi ? `https://doi.org/${ref.doi}` : undefined),
      },
    });
  }

  return claims;
}

// Generate human-readable prompt
function generatePrompt(claims: ClaimToVerify[]): string {
  let prompt = `# Fact Verification Request

Please verify that each claim accurately represents the cited research.
For each claim, respond with:
- ✅ ACCURATE - if the claim correctly represents the research
- ⚠️ NEEDS REVIEW - if the claim oversimplifies or needs nuance
- ❌ INACCURATE - if the claim misrepresents the research
- ❓ CANNOT VERIFY - if you need more information

---

`;

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    prompt += `## Claim ${i + 1}
**File:** ${claim.file} (line ${claim.lineNumber})

**Claim:** "${claim.claim}"

**Reference [${claim.reference.number}]:** ${claim.reference.citation}
${claim.reference.link ? `**Link:** ${claim.reference.link}` : ""}

**Your verdict:**

---

`;
  }

  return prompt;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes("--json");
  const validateAll = args.includes("--all");
  const validateChanged = args.includes("--changed");
  const validateStaged = args.includes("--staged");
  const diffOnly = args.includes("--diff-only"); // Only validate changed lines, not whole files
  const sampleIndex = args.indexOf("--sample");
  const sampleSize =
    sampleIndex !== -1 ? parseInt(args[sampleIndex + 1], 10) : undefined;

  // Get base commit for comparison (default: HEAD~1)
  const baseIndex = args.indexOf("--base");
  const baseCommit = baseIndex !== -1 ? args[baseIndex + 1] : "HEAD~1";

  // Determine which files to validate
  let filesToValidate: string[] = [];
  let useLineFiltering = false;

  if (validateAll) {
    filesToValidate = findMarkdownFiles(LEARN_DIR).filter((f) =>
      f.includes("module-")
    );
  } else if (validateStaged) {
    filesToValidate = getStagedFiles();
    useLineFiltering = diffOnly;
  } else if (validateChanged) {
    filesToValidate = getChangedFiles(baseCommit);
    useLineFiltering = diffOnly;
  } else {
    const fileArgs = args.filter(
      (a) => !a.startsWith("--") && !a.startsWith("-") && !parseInt(a)
    );
    if (fileArgs.length > 0) {
      filesToValidate = fileArgs.map((f) =>
        path.isAbsolute(f) ? f : path.join(process.cwd(), f)
      );
    }
  }

  if (filesToValidate.length === 0) {
    console.log(`🔬 Fact Validation Script

Usage:
  npx tsx scripts/validate-facts.ts [file.md...]  # Specific file(s) - works with lint-staged
  npx tsx scripts/validate-facts.ts --all         # All module files
  npx tsx scripts/validate-facts.ts --changed     # Git-changed files (vs HEAD~1)
  npx tsx scripts/validate-facts.ts --staged      # Git-staged files (for pre-commit)

Options:
  --json              Output as JSON for processing
  --sample N          Only verify N random claims
  --diff-only         Only validate citations on changed lines (minimizes tokens)
  --base <ref>        Compare against specific commit/branch (default: HEAD~1)
                      Use with --changed

Example workflows:
  # lint-staged: pass files directly (minimal tokens)
  npx tsx scripts/validate-facts.ts path/to/file.md

  # Compare against main branch
  npx tsx scripts/validate-facts.ts --changed --base main --diff-only

  # Pre-commit hook: validate staged changes only
  npx tsx scripts/validate-facts.ts --staged --diff-only

  # Generate verification prompts for all files
  npx tsx scripts/validate-facts.ts --all --sample 10

  # Output JSON for automated processing
  npx tsx scripts/validate-facts.ts --all --json > claims.json

lint-staged config example (package.json):
  "lint-staged": {
    "src/content/docs/learn/**/*.md": "tsx scripts/validate-facts.ts"
  }
`);
    return;
  }

  // Process all files
  let allClaims: ClaimToVerify[] = [];
  let totalChangedLines = 0;

  for (const file of filesToValidate) {
    let changedLines: Set<number> | undefined;

    if (useLineFiltering) {
      if (validateStaged) {
        changedLines = getStagedLineNumbers(file);
      } else {
        changedLines = getChangedLineNumbers(file, baseCommit);
      }
      totalChangedLines += changedLines.size;
    }

    const claims = processFile(file, changedLines);
    allClaims.push(...claims);
  }

  // Sample if requested
  if (sampleSize && sampleSize < allClaims.length) {
    // Shuffle and take first N
    allClaims = allClaims.sort(() => Math.random() - 0.5).slice(0, sampleSize);
  }

  if (!outputJson) {
    console.error(`\n📊 Found ${allClaims.length} unique claims to verify\n`);
    if (useLineFiltering) {
      console.error(`Mode: Changed lines only (${totalChangedLines} lines across ${filesToValidate.length} files)`);
    } else {
      console.error(`Mode: Full files (${filesToValidate.length} files)`);
    }
    console.error(`Claims extracted: ${allClaims.length}\n`);
    console.error(`${"=".repeat(60)}\n`);
  }

  // Output
  if (outputJson) {
    console.log(JSON.stringify(allClaims, null, 2));
  } else {
    console.log(generatePrompt(allClaims));
  }
}

main().catch(console.error);
