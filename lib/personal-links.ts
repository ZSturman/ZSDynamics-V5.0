import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";

export type PersonalLinkKey =
  | "linkedin"
  | "x"
  | "github"
  | "instagram"
  | "bluesky"
  | "email"
  | "threads"
  | "imdb";

export interface PersonalLinkEntry {
  key: PersonalLinkKey;
  label: string;
  href: string;
  iconSrc: string;
}

export interface PersonalLinksCollection {
  links: PersonalLinkEntry[];
}

interface PersonalLinkCsvRow {
  label: string;
  url?: string;
  email?: string;
}

interface PersonalLinkSpec {
  label: string;
  iconSrc: string;
  section: "profile";
  aliases?: string[];
}

const PERSONAL_LINK_SPECS: Record<PersonalLinkKey, PersonalLinkSpec> = {
  linkedin: {
    label: "LinkedIn",
    iconSrc: "/icons/linkedin.svg",
    section: "profile",
  },
  x: {
    label: "X",
    iconSrc: "/icons/X.svg",
    section: "profile",
  },
  github: {
    label: "GitHub",
    iconSrc: "/icons/github.svg",
    section: "profile",
  },
  instagram: {
    label: "Instagram",
    iconSrc: "/icons/instagram.svg",
    section: "profile",
  },
  bluesky: {
    label: "Bluesky",
    iconSrc: "/icons/bluesky.svg",
    section: "profile",
    aliases: ["bsky", "bluesky", "blueskyapp"],
  },
  email: {
    label: "Email",
    iconSrc: "/icons/email.svg",
    section: "profile",
  },
  threads: {
    label: "Threads",
    iconSrc: "/icons/threads.svg",
    section: "profile",
  },
  imdb: {
    label: "IMDb",
    iconSrc: "/icons/imdb.svg",
    section: "profile",
  },
};

const PERSONAL_LINK_ORDER: PersonalLinkKey[] = [
  "email",
  "github",
  "linkedin",
  "x",
  "threads",
  "instagram",
  "bluesky",
  "imdb",
];

const DEFAULT_PERSONAL_LINK_ROWS: PersonalLinkCsvRow[] = [
  { label: "LinkedIn", url: "https://linkedin.com/in/zacharysturman" },
  { label: "X", url: "https://x.com/XzckndhttqZ" },
  { label: "GitHub", url: "https://github.com/zsturman" },
  { label: "Instagram", url: "https://www.instagram.com/zachary.sturman/" },
  { label: "BlueSky", url: "https://bsky.app/profile/zacharysturman.bsky.social" },
  { label: "Email", email: "zasturman@gmail.com" },
  { label: "Threads", url: "https://www.threads.com/@zachary.sturman" },
  { label: "IMDb", url: "https://www.imdb.com/name/nm6373994/?ref_=ext_shr_lnk" },
];

function normalizePersonalLinkValue(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function inferPersonalLinkKey(label: string): PersonalLinkKey | null {
  const normalizedLabel = normalizePersonalLinkValue(label);

  for (const [key, spec] of Object.entries(PERSONAL_LINK_SPECS) as Array<[PersonalLinkKey, PersonalLinkSpec]>) {
    const aliases = [key, spec.label, ...(spec.aliases || [])];
    if (aliases.some((alias) => normalizePersonalLinkValue(alias) === normalizedLabel)) {
      return key;
    }
  }

  return null;
}

function parsePersonalLinksCsv(rawCsv: string): PersonalLinkCsvRow[] {
  const rows = rawCsv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rows.length === 0) {
    return [];
  }

  const [headerLine, ...dataLines] = rows;
  const headers = headerLine.split(",").map((header) => header.trim().toLowerCase());

  return dataLines
    .map((line) => {
      const columns = line.split(",");
      const row: PersonalLinkCsvRow = { label: "" };

      headers.forEach((header, index) => {
        const value = columns[index]?.trim() || "";
        if (header === "label") {
          row.label = value;
        }
        if (header === "url") {
          row.url = value;
        }
        if (header === "email") {
          row.email = value;
        }
      });

      return row;
    })
    .filter((row) => row.label.length > 0);
}

function loadPersonalLinkRows(): PersonalLinkCsvRow[] {
  const csvPath = path.join(process.cwd(), "docs", "personal_links.csv");
  if (!existsSync(csvPath)) {
    return DEFAULT_PERSONAL_LINK_ROWS;
  }

  try {
    const parsedRows = parsePersonalLinksCsv(readFileSync(csvPath, "utf8"));
    return parsedRows.length > 0 ? parsedRows : DEFAULT_PERSONAL_LINK_ROWS;
  } catch {
    return DEFAULT_PERSONAL_LINK_ROWS;
  }
}

function toHref(row: PersonalLinkCsvRow): string | null {
  if (row.email) {
    return `mailto:${row.email.trim()}`;
  }

  if (row.url) {
    return row.url.trim();
  }

  return null;
}

function orderLinks(
  linksByKey: Map<PersonalLinkKey, PersonalLinkEntry>,
  order: PersonalLinkKey[],
): PersonalLinkEntry[] {
  return order
    .map((key) => linksByKey.get(key))
    .filter((link): link is PersonalLinkEntry => Boolean(link));
}

export const loadPersonalLinks = cache((): PersonalLinksCollection => {
  const rows = loadPersonalLinkRows();
  const linksByKey = new Map<PersonalLinkKey, PersonalLinkEntry>();

  for (const row of rows) {
    const key = inferPersonalLinkKey(row.label);
    const href = toHref(row);

    if (!key || !href) {
      continue;
    }

    const spec = PERSONAL_LINK_SPECS[key];
    linksByKey.set(key, {
      key,
      label: spec.label,
      href,
      iconSrc: spec.iconSrc,
    });
  }

  return {
    links: orderLinks(linksByKey, PERSONAL_LINK_ORDER),
  };
});
