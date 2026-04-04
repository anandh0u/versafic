import fs from "node:fs";
import path from "node:path";

export type LegacyTemplate = {
  markup: string;
  styles: string;
  script: string;
};

const templatesDir = path.join(process.cwd(), "legacy", "templates");
const sharedStylePath = path.join(templatesDir, "style.css");

const routeReplacements: Array<[RegExp, string]> = [
  [/href="index\.html"/g, 'href="/"'],
  [/href="index\.html#([^"]+)"/g, 'href="/#$1"'],
  [/href="search\.html"/g, 'href="/search"'],
  [/href="onboarding\.html"/g, 'href="/onboarding"'],
  [/href="dashboard\.html"/g, 'href="/dashboard"'],
  [/href="profile\.html\?id=\$\{([^}]+)\}"/g, 'href="/profile/${$1}"'],
  [/profile\.html\?id=\$\{([^}]+)\}/g, "/profile/${$1}"],
  [/profile\.html\?id=([0-9]+)/g, "/profile/$1"],
  [/href="profile\.html"/g, 'href="/profile/1"'],
  [/window\.location\.href='dashboard\.html'/g, "window.location.href='/dashboard'"],
  [/window\.location\.href = 'search\.html'/g, "window.location.href = '/search'"],
  [/window\.location\.href = 'search\.html' \+ \(q \? '\?q=' \+ encodeURIComponent\(q\) : ''\)/g, "window.location.href = '/search' + (q ? '?q=' + encodeURIComponent(q) : '')"],
  [/window\.location\.href = \"dashboard\.html\"/g, 'window.location.href = "/dashboard"'],
];

const applyRouteReplacements = (input: string) =>
  routeReplacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), input);

const extractSection = (source: string, tag: string) => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const matches = [...source.matchAll(regex)];
  return matches.map((match) => match[1]).join("\n");
};

export const loadLegacyTemplate = (
  name: "index" | "dashboard" | "onboarding" | "search" | "profile",
  options?: {
    profileId?: string;
  }
): LegacyTemplate => {
  const filePath = path.join(templatesDir, `${name}.html`);
  const html = fs.readFileSync(filePath, "utf8");
  const sharedStyles = fs.existsSync(sharedStylePath) ? fs.readFileSync(sharedStylePath, "utf8") : "";
  const pageStyles = extractSection(html, "style");
  const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  const pageScript = scriptMatches.map((match) => match[1]).join("\n");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const rawBody = bodyMatch ? bodyMatch[1] : html;
  const bodyWithoutScripts = rawBody.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  let script = applyRouteReplacements(pageScript);
  let markup = applyRouteReplacements(bodyWithoutScripts);

  if (name === "profile" && options?.profileId) {
    script = script.replace(
      /const id = params\.get\('id'\) \|\| '1';/g,
      `const id = '${options.profileId}' || params.get('id') || '1';`
    );
    markup = markup.replace(/href="\/profile\/1"/g, `href="/profile/${options.profileId}"`);
  }

  return {
    markup: markup.trim(),
    styles: `${sharedStyles}\n${pageStyles}`.trim(),
    script: script.trim(),
  };
};
