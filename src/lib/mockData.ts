const _NOW = Date.now();
const _MIN = 60 * 1000;
const _HR  = 60 * _MIN;

// ── ユーザー共通型 ────────────────────────────────────────────────
export interface AppUser {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  isFriend: boolean;
}

// ── ユーザー一覧（最小限：1人のみ） ─────────────────────────────
// つながり追加などのUIテスト用。本番はSupabaseから取得。
export const MOCK_USERS: AppUser[] = [
  { id: 'yuki_syncs', name: 'Yuki', handle: '@yuki_m', avatar: '🌸', isFriend: true },
];

// ── 自分のユーザー情報 ────────────────────────────────────────────
export const CURRENT_USER = {
  avatar:   '✨',
  name:     'you',
  handle:   '@you',
  bio:      'Music, coffee, and late nights. Here for the vibes 🎵',
  hashtags: ['#jprock','#live','#music','#design','#photo','#night','#coffee','#minimal','#film','#engineer'],
};

// ── チャット会話 ─────────────────────────────────────────────────
export interface Conversation {
  id: string;
  avatar: string;
  name: string;
  handle?: string;
  preview: string;
  time: string;
  unread: boolean;
  isGroup?: boolean;
  memberAvatars?: string[];
}

// つながり1件のみ残す。本番はSupabaseから取得。
export const CONVERSATIONS: Conversation[] = [
  {
    id: 'ca3e646f-546f-4164-9a6b-0b443621a275', avatar: '🌸', name: 'Yuki', handle: '@yuki_m',
    preview: "We met at the live! Where's next…",
    time: 'Now', unread: true,
  },
];

export interface Post {
  id: string;
  avatar: string;
  handle: string;
  name: string;
  content: string;
  hashtags: string[];
  time: string;
  createdAt: number;
  expiresAt: number;
  lat?: number | null;
  lng?: number | null;
  isMutual: boolean;
}

// 自分がフォローしているハッシュタグ（1個のみ）。本番はSupabaseから取得。
export const FOLLOWED_HASHTAGS: string[] = [
  '#jprock',
];

// ── 投稿フィード → Supabaseから取得 ──────────────────────────────
export const TIMELINE_POSTS: Post[] = [];
export const FRIENDS_POSTS: Post[]  = [];
export const MY_POSTS: Post[]       = [];

// ── Memory Calendar → Supabaseから取得 ───────────────────────────
export type Reaction = {
  id:       string;
  emoji:    string;
  name:     string;
  username: string;
  avatar:   string;
  userId:   string;
};

export type MemoryDayData = {
  posts:          { id: string; text: string; reactions?: Reaction[] }[];
  savedPhotos:    { id: string; url: string }[];
  newConnections: { id: string; name: string; username: string; avatar: string; userId: string }[];
  events:         { id: string; name: string; eventId: string }[];
};

export const MEMORY_DATA: Record<string, MemoryDayData> = {};

// ── Search / Discover ─────────────────────────────────────────────
export const INFO_EVENTS = [
  {
    id: "e1", emoji: "🎸",
    title: "SYNC LIVE 2026 × Shinjuku",
    date: "3/15 (Sat) 18:00", isoDate: "2026-03-15T18:00:00", place: "Shinjuku LOFT",
    tags: ["#jprock", "#live"],
    desc: "A night of music and connection for people with the same passion. Your ticket is just that passion.",
  },
  {
    id: "e2", emoji: "📷",
    title: "Photo Club × Shibuya Snap Walk",
    date: "3/16 (Sun) 14:00", isoDate: "2026-03-16T14:00:00", place: "Shibuya Scramble",
    tags: ["#photo", "#night"],
    desc: "Walk around Shibuya with just your phone. A night snap meetup.",
  },
  {
    id: "e3", emoji: "💻",
    title: "Engineer × Focus Session",
    date: "3/18 (Tue) 19:30", isoDate: "2026-03-18T19:30:00", place: "Shibuya Hikarie 8F",
    tags: ["#engineer"],
    desc: "Share focused work time together. A casual atmosphere where you can chat too.",
  },
  {
    id: "e4", emoji: "☕",
    title: "Coffee × Late Night Chat",
    date: "3/20 (Thu) 21:00", isoDate: "2026-03-20T21:00:00", place: "Daikanyama T-SITE",
    tags: ["#coffee", "#minimal"],
    desc: "A slow evening with coffee and conversation. Late-night only gathering.",
  },
  {
    id: "e5", emoji: "🎨",
    title: "Design × Meetup",
    date: "3/22 (Sat) 15:00", isoDate: "2026-03-22T15:00:00", place: "Roppongi Midtown",
    tags: ["#design", "#minimal"],
    desc: "Just talk about design. A session on the aesthetics of subtraction.",
  },
];

export const ORGANIZERS = [
  {
    id: "org-e1",
    name: "SYNC LIVE collective",
    icon: "🎸",
    desc: "A community creating music × chance encounters",
    bio: "We keep creating spaces where strangers connect through music.",
    eventsCount: 23,
    eventIds: ["e1"],
  },
  {
    id: "org-e2",
    name: "Photo Club SNAP",
    icon: "📷",
    desc: "A group sharing everyday photo opportunities",
    bio: "Whether you shoot with a smartphone or DSLR.",
    eventsCount: 14,
    eventIds: ["e2"],
  },
  {
    id: "org-e3",
    name: "Focus Session Tokyo",
    icon: "💻",
    desc: "Focused work community for engineers and designers",
    bio: "Late-night solo work is hard to sustain, but somehow it flows when done together.",
    eventsCount: 41,
    eventIds: ["e3"],
  },
  {
    id: "org-e4",
    name: "Late Night Coffee Club",
    icon: "☕",
    desc: "A minimal community that loves coffee and conversation",
    bio: "Late night only. A community for slow evenings with coffee and carefully chosen words.",
    eventsCount: 8,
    eventIds: ["e4"],
  },
  {
    id: "org-e5",
    name: "Design Philosophy Club",
    icon: "🎨",
    desc: "A community exploring the aesthetics of subtraction in design",
    bio: "\"What to remove\" over \"what to add\".",
    eventsCount: 19,
    eventIds: ["e5"],
  },
];

export type HashtagPost = {
  id: string;
  user: { name: string; handle: string; avatar: string };
  content: string;
  time: string;
  likes: number;
  comments: number;
};

export type HashtagEntry = {
  followers: number;
  posts: HashtagPost[];
};

// ハッシュタグ投稿データ → Supabaseから取得
export const HASHTAG_DATA: Record<string, HashtagEntry> = {};

// ── タグエンゲージメント ───────────────────────────────────────────
export function getTagEngagement(tagName: string): {
  postCount: number;
  reactionCount: number;
  unlocked: boolean;
} {
  const data: Record<string, { postCount: number; reactionCount: number }> = {
    'jprock':    { postCount: 3, reactionCount: 10 },
    'live':      { postCount: 1, reactionCount: 4  },
    'music':     { postCount: 3, reactionCount: 10 },
    'photo':     { postCount: 0, reactionCount: 2  },
    'design':    { postCount: 2, reactionCount: 7  },
    'night':     { postCount: 3, reactionCount: 10 },
    'coffee':    { postCount: 1, reactionCount: 9  },
    'minimal':   { postCount: 0, reactionCount: 3  },
    'band':      { postCount: 2, reactionCount: 10 },
    'dance':     { postCount: 3, reactionCount: 6  },
    'sports':    { postCount: 3, reactionCount: 10 },
    'travel':    { postCount: 1, reactionCount: 1  },
    'nightwalk': { postCount: 3, reactionCount: 10 },
    'words':     { postCount: 0, reactionCount: 5  },
  };

  const entry = data[tagName] ?? { postCount: 0, reactionCount: 0 };
  const unlocked = entry.postCount >= 3 && entry.reactionCount >= 10;
  return { ...entry, unlocked };
}
