import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { ClipData, ExtensionSettings, DateFormat } from "./types";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  hr: "---",
});
turndown.use(gfm);

// Remove noise tags before conversion
turndown.remove(["script", "style", "nav", "footer", "iframe", "noscript"]);

export function convertHtmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

function formatDate(dateFormat: DateFormat): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  switch (dateFormat) {
    case "DD-MM-YYYY":
      return `${dd}-${mm}-${yyyy}`;
    case "MM-DD-YYYY":
      return `${mm}-${dd}-${yyyy}`;
    case "YYYY-MM-DD":
    default:
      return `${yyyy}-${mm}-${dd}`;
  }
}

function formatTime(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 8).replace(/:/g, "-");
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function sanitizeFilename(name: string): string {
  // Remove characters not allowed in filenames on Windows/macOS/Linux
  return name
    .replace(/[/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export function buildFilename(
  template: string,
  title: string,
  url: string,
  dateFormat: DateFormat
): string {
  const date = formatDate(dateFormat);
  const time = formatTime();
  const domain = extractDomain(url);
  const cleanTitle = sanitizeFilename(title || "untitled");

  const filename = template
    .replace(/\{title\}/g, cleanTitle)
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)
    .replace(/\{domain\}/g, domain);

  const sanitized = sanitizeFilename(filename);
  return sanitized.endsWith(".md") ? sanitized : sanitized + ".md";
}

export function buildFrontmatter(
  title: string,
  url: string,
  dateFormat: DateFormat
): string {
  const date = formatDate(dateFormat);
  const now = new Date().toISOString();
  return `---
title: "${title.replace(/"/g, '\\"')}"
source: "${url}"
date: "${date}"
saved_at: "${now}"
---

`;
}

export function buildMarkdownDocument(
  clipData: ClipData,
  settings: ExtensionSettings
): string {
  const markdownBody = convertHtmlToMarkdown(clipData.html);

  if (!settings.addFrontmatter) {
    return markdownBody;
  }

  const frontmatter = buildFrontmatter(
    clipData.title,
    settings.includeSourceUrl ? clipData.url : "",
    settings.dateFormat
  );

  return frontmatter + markdownBody;
}
