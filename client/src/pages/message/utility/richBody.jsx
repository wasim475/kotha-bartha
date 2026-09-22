// Turns a plain-text message body into safe React nodes: URLs become real
// links and @mentions get a highlight — built as a plain token array and
// rendered as JSX children, never as raw HTML, so there's no injection risk.
const urlSource = "(?:https?:\\/\\/|www\\.)[^\\s<]+";

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function tokenizeMessageBody(body, mentionNames = []) {
  const names = [...new Set(mentionNames.filter(Boolean))].map(escapeRegExp);
  const pattern = names.length
    ? `(${urlSource})|(@(?:${names.join("|")})\\b)`
    : `(${urlSource})`;
  const regex = new RegExp(pattern, "gi");

  const nodes = [];
  let lastIndex = 0;
  let match = regex.exec(body);
  let key = 0;

  while (match) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: body.slice(lastIndex, match.index), key: key++ });
    }
    const token = match[0];
    nodes.push({ type: token.startsWith("@") ? "mention" : "url", text: token, key: key++ });
    lastIndex = match.index + token.length;
    match = regex.exec(body);
  }

  if (lastIndex < body?.length) {
    nodes.push({ type: "text", text: body.slice(lastIndex), key: key++ });
  }

  return nodes;
}

export const normalizeUrl = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

export const firstUrlIn = (body) => {
  const match = new RegExp(urlSource, "i").exec(body || "");
  return match ? match[0] : null;
};
