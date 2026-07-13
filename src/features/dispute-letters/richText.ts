const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U"]);
const ALLOWED_PARAGRAPH_CLASSES = new Set([
  "letter-block",
  "sender-block",
  "date-block",
  "recipient-block",
  "report-metadata-block",
  "list-item",
  "list-item-dash",
  "list-item-dot",
]);

const unwrapNode = (node: Node) => {
  const parent = node.parentNode;
  if (!parent) {
    return;
  }
  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node);
  }
  parent.removeChild(node);
};

export const sanitizeEditableHtml = (value: string) => {
  if (typeof window === "undefined") {
    return value;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${value}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLElement | null;
  if (!container) {
    return "";
  }

  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null);
  const toInspect: Element[] = [];
  while (walker.nextNode()) {
    toInspect.push(walker.currentNode as Element);
  }

  for (const element of toInspect) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      unwrapNode(element);
      continue;
    }
    for (const attribute of [...element.attributes]) {
      if (attribute.name === "class" && element.tagName === "P") {
        const safeClasses = attribute.value
          .split(/\s+/)
          .map((entry) => entry.trim())
          .filter((entry) => ALLOWED_PARAGRAPH_CLASSES.has(entry));
        if (safeClasses.length > 0) {
          element.setAttribute("class", safeClasses.join(" "));
          continue;
        }
      }
      element.removeAttribute(attribute.name);
    }
  }

  return container.innerHTML
    .replace(/<div>/gi, "<p>")
    .replace(/<\/div>/gi, "</p>")
    .replace(/<p><\/p>/gi, "")
    .trim();
};
