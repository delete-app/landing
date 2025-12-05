#!/usr/bin/env npx tsx
/**
 * Fix Citation Format Script
 *
 * Standardizes all citation formats to: <sup>[[N]](#references)</sup>
 *
 * Handles:
 * - <sup>N</sup> → <sup>[[N]](#references)</sup>
 * - Unicode superscripts ¹²³⁴⁵⁶⁷⁸⁹⁰ → <sup>[[N]](#references)</sup>
 * - <sup>[N]</sup> → <sup>[[N]](#references)</sup>
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEARN_DIR = path.join(__dirname, "../src/content/docs/learn");

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

// Unicode superscript mapping
const UNICODE_SUPERSCRIPTS: Record<string, string> = {
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁰": "0",
};

interface FileStats {
  file: string;
  supN: number; // <sup>N</sup>
  supBracketN: number; // <sup>[N]</sup>
  unicode: number; // ¹²³
  correct: number; // <sup>[[N]](#references)</sup>
  fixed: boolean;
}

function detectFormats(content: string): Omit<FileStats, "file" | "fixed"> {
  // Count each format
  const supN = (content.match(/<sup>(\d+)<\/sup>/g) || []).length;
  const supBracketN = (content.match(/<sup>\[(\d+)\]<\/sup>/g) || []).length;
  const unicode = (content.match(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g) || []).length;
  const correct = (
    content.match(/<sup>\[\[\d+\]\]\(#references\)<\/sup>/g) || []
  ).length;

  return { supN, supBracketN, unicode, correct };
}

function fixCitations(content: string): string {
  let fixed = content;

  // 1. Fix <sup>N</sup> format (but not inside reference links)
  // Need to be careful not to match numbers that are part of other patterns
  fixed = fixed.replace(/<sup>(\d+)<\/sup>/g, (match, num) => {
    return `<sup>[[${num}]](#references)</sup>`;
  });

  // 2. Fix <sup>[N]</sup> format
  fixed = fixed.replace(/<sup>\[(\d+)\]<\/sup>/g, (match, num) => {
    return `<sup>[[${num}]](#references)</sup>`;
  });

  // 3. Fix unicode superscripts (can be multiple digits like ¹²)
  // Match sequences of unicode superscripts
  fixed = fixed.replace(/([¹²³⁴⁵⁶⁷⁸⁹⁰]+)/g, (match) => {
    // Convert unicode to regular numbers
    const num = match
      .split("")
      .map((char) => UNICODE_SUPERSCRIPTS[char] || char)
      .join("");
    return `<sup>[[${num}]](#references)</sup>`;
  });

  // 4. Fix any double-converted patterns (in case we run twice)
  fixed = fixed.replace(
    /<sup>\[\[<sup>\[\[(\d+)\]\]\(#references\)<\/sup>\]\]\(#references\)<\/sup>/g,
    "<sup>[[$1]](#references)</sup>"
  );

  return fixed;
}

async function main() {
  console.log("🔧 Citation Format Fixer\n");

  const allFiles = findMarkdownFiles(LEARN_DIR);
  const files = allFiles
    .filter((f) => f.includes("module-"))
    .map((f) => path.relative(LEARN_DIR, f));

  const stats: FileStats[] = [];

  let totalFixed = 0;
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log("📋 DRY RUN MODE - No files will be modified\n");
  }

  for (const file of files.sort()) {
    const filePath = path.join(LEARN_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");

    const formats = detectFormats(content);
    const needsFix =
      formats.supN > 0 || formats.supBracketN > 0 || formats.unicode > 0;

    if (needsFix) {
      const fixed = fixCitations(content);
      const newFormats = detectFormats(fixed);

      stats.push({
        file,
        ...formats,
        fixed: true,
      });

      if (!dryRun) {
        fs.writeFileSync(filePath, fixed);
      }

      console.log(`📄 ${file}`);
      console.log(
        `   Before: <sup>N</sup>=${formats.supN}, <sup>[N]</sup>=${formats.supBracketN}, unicode=${formats.unicode}, correct=${formats.correct}`
      );
      console.log(
        `   After:  <sup>N</sup>=${newFormats.supN}, <sup>[N]</sup>=${newFormats.supBracketN}, unicode=${newFormats.unicode}, correct=${newFormats.correct}`
      );
      console.log("");

      totalFixed++;
    }
  }

  console.log("=".repeat(50));
  console.log(`📊 Summary`);
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Files ${dryRun ? "to fix" : "fixed"}: ${totalFixed}`);

  if (dryRun && totalFixed > 0) {
    console.log(`\n💡 Run without --dry-run to apply fixes`);
  }
}

main().catch(console.error);
