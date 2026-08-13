import * as z from "zod";

export const credentialsSchema = z.object({
  email: z.email("Please enter a valid email.").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const signupSchema = credentialsSchema.extend({
  name: z.string().min(1, "Please enter your name.").trim(),
});

export const annotationInputSchema = z.object({
  cfiRange: z.string().min(1),
  text: z.string().min(1),
  comment: z.string().max(5000).default(""),
});

// Freeform topic labels: trimmed, de-duplicated (case-insensitive), capped.
export const tagsSchema = z
  .array(z.string())
  .default([])
  .transform((tags) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tags) {
      const tag = raw.trim().replace(/\s+/g, " ").slice(0, 40);
      const key = tag.toLowerCase();
      if (tag && !seen.has(key)) {
        seen.add(key);
        out.push(tag);
      }
    }
    return out.slice(0, 12);
  });

// A writing-room blog post (markdown body).
export const postInputSchema = z.object({
  title: z.string().min(1, "Give it a title.").max(200).trim(),
  content: z.string().max(100_000).default(""),
  tags: tagsSchema,
  // A cover image URL (our own /api/images path); empty means "none".
  coverImage: z
    .string()
    .max(500)
    .nullish()
    .transform((v) => v?.trim() || null),
  published: z.boolean().default(true),
});

// A sticky note on the hobby board.
export const ideaInputSchema = z.object({
  bucket: z.enum(["read", "write", "explore", "solve"]),
  text: z.string().min(1, "Write something on the note.").max(500).trim(),
});

// A daily-room habit tick: one per habit per (visitor-local) day.
export const dailyTickSchema = z.object({
  kind: z.enum(["article", "spanish", "listening"]),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Day must look like 2026-07-23."),
});

// A frame on the hallway wall (job / project / achievement),
// or a hand-built sandbox project shelved in the workshop.
export const frameInputSchema = z.object({
  kind: z.enum(["job", "gig", "project", "achievement", "sandbox"]),
  title: z.string().min(1, "Give it a title.").max(120).trim(),
  subtitle: z.string().max(600).trim().default(""),
  detail: z.string().max(2000).trim().default(""),
  years: z.string().max(40).trim().nullish(),
  link: z.url("Links need to be full URLs.").nullish().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  sort: z.number().int().default(0),
});

// Which shelf a read sits on. Freeform and made up as you go; "" is the
// catch-all shelf.
export const shelfNameSchema = z
  .string()
  .max(40)
  .transform((s) => s.trim().replace(/\s+/g, " "));

// An article shelved in the daily room.
export const bookmarkInputSchema = z.object({
  url: z.url("A bookmark needs a full URL."),
  title: z.string().min(1, "Give it a title.").max(300).trim(),
  source: z.string().max(120).trim().default(""),
  favorite: z.boolean().default(false),
  shelf: shelfNameSchema.default(""),
});

// Starring a read, or moving it to another shelf.
export const bookmarkPatchSchema = z
  .object({
    favorite: z.boolean().optional(),
    shelf: shelfNameSchema.optional(),
  })
  .refine((v) => v.favorite !== undefined || v.shelf !== undefined, {
    message: "Nothing to change.",
  });

// How well a passage landed: could explain it / sort of / no idea.
export const graspSchema = z.enum(["got", "half", "lost"]);

// A passage marked up while reading an article in the house. The anchor is
// (block, start, end) into the cached body, with the quote kept for re-finding.
export const highlightInputSchema = z.object({
  bookmarkId: z.string().min(1),
  block: z.number().int().min(0),
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  quote: z.string().min(1, "Select some text first.").max(2000),
  grasp: graspSchema,
  note: z.string().max(2000).trim().default(""),
});

// Editing one afterwards: change the colour, the note, or both.
export const highlightPatchSchema = z
  .object({
    grasp: graspSchema.optional(),
    note: z.string().max(2000).trim().optional(),
  })
  .refine((v) => v.grasp !== undefined || v.note !== undefined, {
    message: "Nothing to change.",
  });

// Ticking a roadmap step off, or rating how solid it feels (0 unrated,
// 1 lost, 2 shaky, 3 solid).
export const roadmapStepPatchSchema = z
  .object({
    done: z.boolean().optional(),
    confidence: z.number().int().min(0).max(3).optional(),
  })
  .refine((v) => v.done !== undefined || v.confidence !== undefined, {
    message: "Nothing to change.",
  });

// A LeetCode handle: their own allowed character set, no URLs.
export const leetcodeUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your LeetCode username.")
    .max(39)
    .regex(
      /^[A-Za-z0-9_.-]+$/,
      "That doesn't look like a LeetCode username — just the handle, not the URL.",
    ),
});

// How a drilled LeetCode problem went: the verdict, how hard it felt
// (1 brutal → 5 easy, 0 unrated), and whatever you want to remember about it.
// Any of the three can be sent on its own. status "clear" un-logs it.
export const problemLogSchema = z
  .object({
    url: z.url("A problem needs its link."),
    name: z.string().min(1).max(200).trim(),
    pattern: z.string().min(1).max(200).trim(),
    status: z.enum(["solved", "struggled", "clear"]).optional(),
    rating: z.number().int().min(0).max(5).optional(),
    note: z.string().max(4000).optional(),
  })
  .refine(
    (v) =>
      v.status !== undefined || v.rating !== undefined || v.note !== undefined,
    { message: "Nothing to log." },
  );

// Pulling an article's body into the house: fetch it, or paste it by hand
// when the site won't hand it over.
export const articleInputSchema = z.union([
  z.object({ mode: z.literal("fetch") }),
  z.object({
    mode: z.literal("paste"),
    text: z.string().min(1, "Paste the article text first.").max(400_000),
  }),
]);
