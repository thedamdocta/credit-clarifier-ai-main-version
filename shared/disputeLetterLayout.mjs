import disputeLetterLayout from "./disputeLetterLayout.json" with { type: "json" };

export const DISPUTE_LETTER_LAYOUT = Object.freeze({
  ...disputeLetterLayout,
});

export const buildDisputeLetterLayoutCssVariables = () => ({
  "--dispute-letter-page-width": `${DISPUTE_LETTER_LAYOUT.pageWidthInches}in`,
  "--dispute-letter-page-height": `${DISPUTE_LETTER_LAYOUT.pageHeightInches}in`,
  "--dispute-letter-page-padding": `${DISPUTE_LETTER_LAYOUT.marginInches}in`,
  "--dispute-letter-font-family": DISPUTE_LETTER_LAYOUT.fontFamily,
  "--dispute-letter-font-size": `${DISPUTE_LETTER_LAYOUT.fontSizePt}pt`,
  "--dispute-letter-line-height": String(DISPUTE_LETTER_LAYOUT.lineHeight),
  "--dispute-letter-text-color": DISPUTE_LETTER_LAYOUT.textColor,
  "--dispute-letter-page-color": DISPUTE_LETTER_LAYOUT.pageColor,
  "--dispute-letter-page-shadow": DISPUTE_LETTER_LAYOUT.pageShadow,
  "--dispute-letter-paragraph-space": `${DISPUTE_LETTER_LAYOUT.paragraphSpaceAfterPt}pt`,
  "--dispute-letter-block-space": `${DISPUTE_LETTER_LAYOUT.blockSpaceAfterPt}pt`,
  "--dispute-letter-heading-space": `${DISPUTE_LETTER_LAYOUT.accountHeadingSpaceAfterPt}pt`,
});

export const buildDisputeLetterPreviewCss = () => {
  const {
    pageWidthInches,
    pageHeightInches,
    marginInches,
    backgroundColor,
    pageColor,
    borderColor,
    textColor,
    fontFamily,
    fontSizePt,
    lineHeight,
    paragraphSpaceAfterPt,
    blockSpaceAfterPt,
    pageShadow,
  } = DISPUTE_LETTER_LAYOUT;
  const listSpaceAfterPt = Math.max(6, Math.round(paragraphSpaceAfterPt * 0.7));

  return `
    :root {
      --page-width: ${pageWidthInches}in;
      --page-height: ${pageHeightInches}in;
      --page-margin: ${marginInches}in;
    }
    body {
      margin: 0;
      background: ${backgroundColor};
      color: ${textColor};
      font-family: ${fontFamily};
    }
    .preview-shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      padding: 24px 0 32px;
    }
    .page {
      width: var(--page-width);
      height: var(--page-height);
      background: ${pageColor};
      box-shadow: ${pageShadow};
      border: 1px solid ${borderColor};
      padding: var(--page-margin);
      box-sizing: border-box;
      overflow: hidden;
      break-after: page;
      page-break-after: always;
    }
    .page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .page-content {
      height: calc(var(--page-height) - (var(--page-margin) * 2));
      overflow: hidden;
      box-sizing: border-box;
    }
    .page-content.page-content-overflow {
      overflow: visible;
    }
    p {
      margin: 0 0 ${paragraphSpaceAfterPt}pt;
      font-size: ${fontSizePt}pt;
      line-height: ${lineHeight};
    }
    p.letter-block {
      margin-bottom: ${blockSpaceAfterPt}pt;
    }
    p + p {
      margin-top: 0;
    }
    strong {
      font-weight: 700;
    }
    p.account-heading {
      margin-bottom: ${DISPUTE_LETTER_LAYOUT.accountHeadingSpaceAfterPt}pt;
    }
    p.list-item {
      margin-bottom: ${listSpaceAfterPt}pt;
      padding-left: 0.34in;
      text-indent: -0.18in;
    }
    .exhibit-figure,
    .exhibit-slide {
      margin: ${blockSpaceAfterPt}pt 0;
    }
    .exhibit-figure img,
    .exhibit-slide img {
      /* width/height attrs are emitted PRE-SCALED by the letter builder
         (content-width + 8in height cap, mirroring DOCX/PDF sizing), so the
         synchronous pagination measurement sees the exact final size before
         the image loads. Never add width/height:auto here — an unloaded image
         with auto dimensions measures ~0 and the paginator packs pages wrong.
         max-width stays as a safety net for legacy markup without attrs. */
      max-width: 100%;
      height: auto;
      display: block;
      border: 1px solid #d1d5db;
    }
    p.exhibit-heading {
      margin-bottom: 4pt;
    }
    p.exhibit-caption {
      margin-top: 2pt;
      margin-bottom: ${blockSpaceAfterPt}pt;
      font-size: ${Math.max(8, fontSizePt - 2)}pt;
      color: #374151;
    }
    p.exhibit-reference {
      margin-bottom: ${blockSpaceAfterPt}pt;
    }
    #document-source {
      display: none;
    }
    @page {
      size: ${pageWidthInches}in ${pageHeightInches}in;
      margin: 0;
    }
    @media print {
      body {
        background: #fff;
      }
      .preview-shell {
        gap: 0;
        padding: 0;
      }
      .page {
        border: none;
        box-shadow: none;
      }
    }
  `;
};

export const buildDisputeLetterPreviewPaginationScript = () => `
  (() => {
    const source = document.getElementById("document-source");
    const shell = document.getElementById("preview-shell");

    if (!source || !shell) {
      return;
    }

    const createPageContent = () => {
      const page = document.createElement("section");
      page.className = "page";
      const content = document.createElement("div");
      content.className = "page-content";
      page.appendChild(content);
      shell.appendChild(page);
      return content;
    };

    const appendNode = (content, node, pageHasContent) => {
      content.appendChild(node);

      if (content.scrollHeight <= content.clientHeight + 2) {
        return { content, pageHasContent: true };
      }

      content.removeChild(node);

      if (!pageHasContent) {
        content.classList.add("page-content-overflow");
        content.appendChild(node);
        return { content, pageHasContent: true };
      }

      const nextContent = createPageContent();
      nextContent.appendChild(node);

      if (nextContent.scrollHeight > nextContent.clientHeight + 2) {
        nextContent.classList.add("page-content-overflow");
      }

      return { content: nextContent, pageHasContent: true };
    };

    const nodes = Array.from(source.childNodes);
    let currentContent = createPageContent();
    let pageHasContent = false;

    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.textContent || !node.textContent.trim()) {
          continue;
        }
        const paragraph = document.createElement("p");
        paragraph.textContent = node.textContent;
        const result = appendNode(currentContent, paragraph, pageHasContent);
        currentContent = result.content;
        pageHasContent = result.pageHasContent;
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const result = appendNode(currentContent, node, pageHasContent);
      currentContent = result.content;
      pageHasContent = result.pageHasContent;
    }

    source.remove();

    const postHeight = () => {
      window.parent?.postMessage(
        {
          type: "dispute-letter-preview-height",
          height: Math.ceil(document.documentElement.scrollHeight),
        },
        "*",
      );
    };

    requestAnimationFrame(postHeight);
    window.addEventListener("load", () => requestAnimationFrame(postHeight), { once: true });
  })();
`;
