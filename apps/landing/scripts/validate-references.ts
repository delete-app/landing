#!/usr/bin/env npx tsx
/**
 * Reference Link Validator for Learn Module Content
 *
 * Validates that all DOI links in the markdown files are reachable.
 * Checks both the DOI resolver (doi.org) and ensures proper formatting.
 *
 * Usage:
 *   npx tsx apps/landing/scripts/validate-references.ts
 *   npx tsx apps/landing/scripts/validate-references.ts --verbose
 *   npx tsx apps/landing/scripts/validate-references.ts --file module-6-staying-together/1-maintaining-intimacy.md
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const CONTENT_DIR = join(
  import.meta.dirname,
  "../src/content/docs/learn"
);

// Regex patterns
const DOI_LINK_PATTERN =
  /<a\s+href="(https:\/\/doi\.org\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
const INLINE_CITATION_PATTERN = /\[\[(\d+)\]\]\(#references\)/g;
const REFERENCE_NUMBER_PATTERN = /^(\d+)\.\s+/gm;

interface Reference {
  number: number;
  link: string | null;
  linkType: "doi" | "pubmed" | "pmc" | "other" | null;
  displayText: string;
  line: number;
}

interface Citation {
  number: number;
  line: number;
}

interface ValidationResult {
  file: string;
  references: Reference[];
  citations: Citation[];
  errors: string[];
  warnings: string[];
}

interface LinkCheckResult {
  url: string;
  status: "ok" | "error" | "redirect";
  statusCode?: number;
  error?: string;
  redirectUrl?: string;
}

// Get all markdown files recursively
function getMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// Determine link type from URL
function getLinkType(url: string): "doi" | "pubmed" | "pmc" | "other" {
  if (url.includes("doi.org/")) return "doi";
  if (url.includes("pubmed.ncbi.nlm.nih.gov")) return "pubmed";
  if (url.includes("pmc.ncbi.nlm.nih.gov")) return "pmc";
  return "other";
}

// Parse references from markdown content
function parseReferences(content: string, filePath: string): Reference[] {
  const references: Reference[] = [];
  const lines = content.split("\n");

  // Find the References section
  let inReferencesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^##\s*References/i)) {
      inReferencesSection = true;
      continue;
    }

    if (inReferencesSection && line.match(/^##\s+/)) {
      // New section, stop parsing references
      break;
    }

    if (inReferencesSection) {
      // Check for reference number at start of line
      const refMatch = line.match(/^(\d+)\.\s+/);
      if (refMatch) {
        const refNumber = parseInt(refMatch[1], 10);

        // Find any link in the line (DOI, PubMed, PMC, or other)
        const linkRegex = /<a\s+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/;
        const linkMatch = linkRegex.exec(line);

        // Extract a snippet of the reference text for display
        const refText = line.replace(/^(\d+)\.\s+/, "").substring(0, 60);

        references.push({
          number: refNumber,
          link: linkMatch ? linkMatch[1] : null,
          linkType: linkMatch ? getLinkType(linkMatch[1]) : null,
          displayText: linkMatch ? linkMatch[2] : refText + "...",
          line: i + 1,
        });
      }
    }
  }

  return references;
}

// Parse inline citations from markdown content
function parseCitations(content: string): Citation[] {
  const citations: Citation[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    const citationRegex = /\[\[(\d+)\]\]\(#references\)/g;
    while ((match = citationRegex.exec(line)) !== null) {
      citations.push({
        number: parseInt(match[1], 10),
        line: i + 1,
      });
    }
  }

  return citations;
}

// Check if a link is valid (with rate limiting)
async function checkLink(url: string): Promise<LinkCheckResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": "Delete-Reference-Validator/1.0",
      },
    });

    clearTimeout(timeoutId);

    if (response.status >= 200 && response.status < 400) {
      return { url, status: "ok", statusCode: response.status };
    } else if (response.status >= 300 && response.status < 400) {
      // Redirects are expected for DOI links
      const redirectUrl = response.headers.get("location");
      return {
        url,
        status: "redirect",
        statusCode: response.status,
        redirectUrl: redirectUrl || undefined,
      };
    } else {
      return {
        url,
        status: "error",
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      url,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Validate a single file
function validateFile(filePath: string): ValidationResult {
  const content = readFileSync(filePath, "utf-8");
  const relativePath = relative(CONTENT_DIR, filePath);

  const references = parseReferences(content, filePath);
  const citations = parseCitations(content);

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for duplicate reference numbers
  const refNumbers = references.map((r) => r.number);
  const uniqueRefNumbers = [...new Set(refNumbers)];
  if (refNumbers.length !== uniqueRefNumbers.length) {
    const duplicates = refNumbers.filter(
      (n, i) => refNumbers.indexOf(n) !== i
    );
    errors.push(`Duplicate reference numbers: ${[...new Set(duplicates)].join(", ")}`);
  }

  // Check for sequential reference numbers
  const sortedRefs = [...uniqueRefNumbers].sort((a, b) => a - b);
  for (let i = 0; i < sortedRefs.length; i++) {
    if (sortedRefs[i] !== i + 1) {
      errors.push(
        `Reference numbers not sequential. Expected ${i + 1}, found ${sortedRefs[i]}`
      );
      break;
    }
  }

  // Check that all citations have corresponding references
  const citedNumbers = [...new Set(citations.map((c) => c.number))];
  for (const citedNum of citedNumbers) {
    if (!uniqueRefNumbers.includes(citedNum)) {
      const citation = citations.find((c) => c.number === citedNum);
      errors.push(
        `Citation [[${citedNum}]] on line ${citation?.line} has no corresponding reference`
      );
    }
  }

  // Check that all references are cited
  for (const refNum of uniqueRefNumbers) {
    if (!citedNumbers.includes(refNum)) {
      warnings.push(`Reference ${refNum} is never cited in the text`);
    }
  }

  // Check for missing links
  for (const ref of references) {
    if (!ref.link) {
      errors.push(
        `Reference ${ref.number} has no link: "${ref.displayText}"`
      );
    } else if (ref.linkType === "doi" && !ref.link.startsWith("https://doi.org/10.")) {
      warnings.push(
        `Reference ${ref.number}: DOI format may be invalid: ${ref.link}`
      );
    }
  }

  return {
    file: relativePath,
    references,
    citations,
    errors,
    warnings,
  };
}

// Main validation function
async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const checkLinks = args.includes("--check-links");
  const fileFilter = args.find((a) => a.startsWith("--file="))?.split("=")[1];

  console.log("🔍 Reference Link Validator for Learn Modules\n");

  let files = getMarkdownFiles(CONTENT_DIR);

  if (fileFilter) {
    files = files.filter((f) => f.includes(fileFilter));
    if (files.length === 0) {
      console.error(`No files found matching: ${fileFilter}`);
      process.exit(1);
    }
  }

  console.log(`Found ${files.length} markdown files\n`);

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalReferences = 0;
  const allLinkResults: Map<string, LinkCheckResult> = new Map();

  for (const file of files) {
    const result = validateFile(file);
    totalReferences += result.references.length;

    const hasIssues = result.errors.length > 0 || result.warnings.length > 0;

    if (hasIssues || verbose) {
      console.log(`📄 ${result.file}`);
      console.log(`   References: ${result.references.length}, Citations: ${result.citations.length}`);

      if (result.errors.length > 0) {
        totalErrors += result.errors.length;
        for (const error of result.errors) {
          console.log(`   ❌ ${error}`);
        }
      }

      if (result.warnings.length > 0) {
        totalWarnings += result.warnings.length;
        for (const warning of result.warnings) {
          console.log(`   ⚠️  ${warning}`);
        }
      }

      if (verbose && result.errors.length === 0 && result.warnings.length === 0) {
        console.log(`   ✅ All checks passed`);
      }

      console.log("");
    }

    // Collect links for checking
    if (checkLinks) {
      for (const ref of result.references) {
        if (ref.link && !allLinkResults.has(ref.link)) {
          allLinkResults.set(ref.link, { url: ref.link, status: "ok" });
        }
      }
    }
  }

  // Check links if requested
  if (checkLinks && allLinkResults.size > 0) {
    console.log(`\n🌐 Checking ${allLinkResults.size} unique links...\n`);

    const urls = [...allLinkResults.keys()];
    let checked = 0;
    let linkErrors = 0;

    for (const url of urls) {
      // Rate limit: 1 request per 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await checkLink(url);
      allLinkResults.set(url, result);
      checked++;

      if (result.status === "error") {
        linkErrors++;
        console.log(`   ❌ ${url}`);
        console.log(`      Error: ${result.error}`);
      } else if (verbose) {
        console.log(`   ✅ ${url}`);
      }

      // Progress indicator
      if (checked % 10 === 0) {
        console.log(`   Progress: ${checked}/${urls.length}`);
      }
    }

    if (linkErrors > 0) {
      totalErrors += linkErrors;
      console.log(`\n❌ ${linkErrors} links failed validation`);
    } else {
      console.log(`\n✅ All ${urls.length} links are valid`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary");
  console.log("=".repeat(50));
  console.log(`   Files checked: ${files.length}`);
  console.log(`   Total references: ${totalReferences}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`   Warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.log("\n❌ Validation failed with errors");
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log("\n⚠️  Validation passed with warnings");
    process.exit(0);
  } else {
    console.log("\n✅ All validations passed");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
