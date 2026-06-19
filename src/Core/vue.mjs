export function extractVueScripts(text) {
  const blocks = [];
  const re = /<script(\s+[a-zA-Z][\w-]*(\s*=\s*(?:"[^"]*"|'[^']*'))?)*\s*\/?>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const attrs = (m[0].slice(7, -1) || "").trim();
    const openEnd = m.index + m[0].length;
    const closeStart = text.toLowerCase().indexOf("</script>", openEnd);
    if (closeStart === -1) break;
    const body = text.slice(openEnd, closeStart);
    if (/\bsrc\s*=\s*["'][^"']+["']/i.test(attrs)) continue;
    if (!body.trim()) continue;
    const setup = /\bsetup\b/i.test(attrs);
    const lang = (attrs.match(/\blang\s*=\s*["']([^"']+)["']/i) || [])[1] || "js";
    blocks.push({ lang: lang.toLowerCase(), setup, text: body });
    re.lastIndex = closeStart + "</script>".length;
  }
  if (!blocks.length) return null;
  return blocks.find((b) => b.setup) || blocks[0];
}

export function vueVirtualPath(realPath, lang) {
  return lang === "ts" ? `${realPath}.ts` : `${realPath}.js`;
}
