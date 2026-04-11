import fs from "node:fs";
import path from "node:path";

export type LegacyTemplate = {
  markup: string;
  styles: string;
  script: string;
};

const templatesDir = path.join(process.cwd(), "legacy", "templates");
const sharedStylePath = path.join(templatesDir, "style.css");

const iconMarkup = (name: string) => `<span class="vf-icon-wrap"><i data-lucide="${name}" class="vf-icon"></i></span>`;

const markupIconReplacements: Array<[string, string]> = [
  ["⚙️", iconMarkup("settings")],
  ["🎙️", iconMarkup("mic")],
  ["🏷️", iconMarkup("tag")],
  ["📞", iconMarkup("phone")],
  ["💬", iconMarkup("message-square")],
  ["🤖", iconMarkup("bot")],
  ["⭐", iconMarkup("star")],
  ["💰", iconMarkup("indian-rupee")],
  ["🏨", iconMarkup("hotel")],
  ["🍽️", iconMarkup("utensils")],
  ["🏥", iconMarkup("hospital")],
  ["📸", iconMarkup("camera")],
  ["💼", iconMarkup("briefcase")],
  ["🎵", iconMarkup("music")],
  ["💻", iconMarkup("monitor")],
  ["🎯", iconMarkup("target")],
  ["📋", iconMarkup("clipboard-list")],
  ["📱", iconMarkup("smartphone")],
  ["📅", iconMarkup("calendar")],
  ["🛎️", iconMarkup("concierge-bell")],
  ["🍷", iconMarkup("wine")],
  ["💊", iconMarkup("pill")],
  ["✂️", iconMarkup("scissors")],
  ["🤝", iconMarkup("handshake")],
  ["📝", iconMarkup("file-text")],
  ["👤", iconMarkup("user")],
  ["✉️", iconMarkup("mail")],
  ["🏠", iconMarkup("house")],
  ["🆕", iconMarkup("sparkles")],
  ["📦", iconMarkup("package")],
];

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

const sanitizeLegacyScript = (name: "index" | "dashboard" | "onboarding" | "search" | "profile", input: string) => {
  if (name === "search" || name === "profile") {
    return "";
  }

  if (name === "dashboard") {
    return input.replace(
      /\s*\/\/ ===== DATE FILTER & MOCK DATA SWAPPING ENGINE =====[\s\S]*?function setBookingFilter\(btn\) \{[\s\S]*?\n\s*\}\n/,
      "\n"
    );
  }

  return input;
};

const applyMarkupIconReplacements = (input: string) =>
  markupIconReplacements.reduce((result, [pattern, replacement]) => result.split(pattern).join(replacement), input);

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

  let script = applyRouteReplacements(sanitizeLegacyScript(name, pageScript));
  let markup = applyMarkupIconReplacements(applyRouteReplacements(bodyWithoutScripts));

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
