import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  hr: "---",
});
turndown.use(gfm);
turndown.remove(["script", "style", "nav", "footer", "iframe", "noscript"]);

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "GET_SELECTION") {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      sendResponse({ markdown: "", title: document.title, url: location.href });
      return true;
    }

    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const div = document.createElement("div");
    div.appendChild(fragment);

    sendResponse({
      markdown: htmlToMarkdown(div.innerHTML),
      title: document.title,
      url: location.href,
    });
    return true;
  }

  if (message.action === "GET_FULL_PAGE") {
    try {
      const docClone = document.cloneNode(true) as Document;
      const reader = new Readability(docClone);
      const article = reader.parse();

      if (article && article.content) {
        sendResponse({
          markdown: htmlToMarkdown(article.content),
          title: article.title || document.title,
          url: location.href,
        });
      } else {
        sendResponse({
          markdown: htmlToMarkdown(document.body.innerHTML),
          title: document.title,
          url: location.href,
        });
      }
    } catch {
      sendResponse({
        markdown: htmlToMarkdown(document.body.innerHTML),
        title: document.title,
        url: location.href,
      });
    }
    return true;
  }

  return false;
});
