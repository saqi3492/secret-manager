export interface EnvPair {
  key: string;
  value: string;
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Parse raw .env text into key/value pairs.
 * Handles: comments (#), blank lines, `export ` prefix, and single/double
 * quoted values. Invalid lines are skipped.
 */
export function parseEnv(text: string): EnvPair[] {
  const pairs: EnvPair[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const withoutExport = line.startsWith("export ")
      ? line.slice("export ".length).trim()
      : line;

    const eq = withoutExport.indexOf("=");
    if (eq === -1) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!KEY_RE.test(key)) continue;

    let value = withoutExport.slice(eq + 1).trim();

    const isQuoted =
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2);

    if (isQuoted) {
      const wasDoubleQuoted = value.startsWith('"');
      value = value.slice(1, -1);
      // Unescape common sequences inside double quotes.
      if (wasDoubleQuoted) {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
    } else {
      // For unquoted values, an inline comment starts at the first `#` that is
      // preceded by whitespace (matches dotenv). `KEY=http://x#frag` keeps the
      // `#`; `KEY=abc # note` drops the comment.
      const commentAt = value.search(/\s#/);
      if (commentAt !== -1) value = value.slice(0, commentAt).trim();
    }

    // Last one wins for duplicate keys.
    if (seen.has(key)) {
      const idx = pairs.findIndex((p) => p.key === key);
      if (idx !== -1) pairs[idx].value = value;
    } else {
      seen.add(key);
      pairs.push({ key, value });
    }
  }

  return pairs;
}

/** Format key/value pairs back into .env text. Quotes values when needed. */
export function formatEnv(pairs: EnvPair[]): string {
  return pairs
    .map(({ key, value }) => {
      const needsQuotes = /[\s#"'=]/.test(value) || value === "";
      if (needsQuotes) {
        const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
        return `${key}="${escaped}"`;
      }
      return `${key}=${value}`;
    })
    .join("\n");
}
