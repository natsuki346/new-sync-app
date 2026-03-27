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

// ── ユーザー一覧（友達 + 非友達） ────────────────────────────────
export const MOCK_USERS: AppUser[] = [
  // 友達（id = handle の @ なし版で統一）
  { id: 'yuki_syncs',  name: 'yuki',   handle: '@yuki_syncs',  avatar: '🌸', isFriend: true  },
  { id: 'kai_designs', name: 'kai',    handle: '@kai_designs', avatar: '🎨', isFriend: true  },
  { id: 'ren_frames',  name: 'ren',    handle: '@ren_frames',  avatar: '📸', isFriend: true  },
  { id: 'tomo_music',  name: 'tomo',   handle: '@tomo_music',  avatar: '🎸', isFriend: true  },
  { id: 'hana_night',  name: 'hana',   handle: '@hana_night',  avatar: '🌺', isFriend: true  },
  { id: 'mio_melody',  name: 'mio',    handle: '@mio_melody',  avatar: '🎵', isFriend: true  },
  { id: 'nagi_brews',  name: 'nagi',   handle: '@nagi_brews',  avatar: '☕', isFriend: true  },
  { id: 'mika_cinema', name: 'mika',   handle: '@mika_cinema', avatar: '🎬', isFriend: true  },
  { id: 'hinata_cafe', name: 'hinata', handle: '@hinata_cafe', avatar: '🌸', isFriend: true  },
  { id: 'ao_writes',   name: 'ao',     handle: '@ao_writes',   avatar: '🖋️', isFriend: true  },
  // 非友達（Timeline に登場するユーザー）
  { id: 'kira_dance',  name: 'kira',  handle: '@kira_dance',  avatar: '⭐', isFriend: false },
  { id: 'sync_vibe',   name: 'sync',  handle: '@sync_vibe',   avatar: '🎵', isFriend: false },
  { id: 'ryu_beats',   name: 'ryu',   handle: '@ryu_beats',   avatar: '🥁', isFriend: false },
  { id: 'luna_writes', name: 'luna',  handle: '@luna_writes', avatar: '🌙', isFriend: false },
  { id: 'mako_films',  name: 'mako',  handle: '@mako_films',  avatar: '🎬', isFriend: false },
  { id: 'jun_design',  name: 'jun',   handle: '@jun_design',  avatar: '✏️', isFriend: false },
  { id: 'haru',        name: 'haru',  handle: '@haru',        avatar: '🎸', isFriend: false },
  { id: 'sora',        name: 'sora',  handle: '@sora',        avatar: '🌊', isFriend: false },
  { id: 'mai',         name: 'mai',   handle: '@mai',         avatar: '💻', isFriend: false },
  { id: 'kei',         name: 'kei',   handle: '@kei',         avatar: '📷', isFriend: false },
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
  handle?: string;       // DM: @handle、グループ: undefined
  preview: string;
  time: string;
  unread: boolean;
  isGroup?: boolean;
  memberAvatars?: string[]; // グループ用
}

export const CONVERSATIONS: Conversation[] = [
  // ── DM ────────────────────────────────────────────────────────
  {
    id: 'c1', avatar: '🌸', name: 'yuki', handle: '@yuki',
    preview: "We met at the live! Where's next…",
    time: 'Now', unread: true,
  },
  {
    id: 'c2', avatar: '🎨', name: 'kai', handle: '@kai',
    preview: 'Thanks for the design advice',
    time: '3m ago', unread: true,
  },
  {
    id: 'c3', avatar: '🎵', name: 'mio', handle: '@mio',
    preview: 'That song gave me chills…!',
    time: '8m ago', unread: true,
  },
  {
    id: 'c4', avatar: '📸', name: 'ren', handle: '@ren',
    preview: "I'll send those photos later",
    time: '1h ago', unread: false,
  },
  {
    id: 'c5', avatar: '🎞️', name: 'tomo', handle: '@tomo',
    preview: 'Would love to shoot together sometime',
    time: '2h ago', unread: true,
  },
  {
    id: 'c6', avatar: '☕', name: 'nagi', handle: '@nagi',
    preview: 'Want to chat over coffee?',
    time: '5h ago', unread: false,
  },
  {
    id: 'c7', avatar: '💻', name: 'mai', handle: '@mai',
    preview: "I'll help you fix that bug lol",
    time: 'Yesterday', unread: false,
  },
  {
    id: 'c8', avatar: '🌙', name: 'luna', handle: '@luna',
    preview: 'Those film photos have such great vibes',
    time: 'Yesterday', unread: false,
  },
  // ── グループ ──────────────────────────────────────────────────
  {
    id: 'g1', avatar: '🎸',
    name: '#jprock lovers',
    preview: 'yuki: Best setlist of the year honestly',
    time: '12m ago', unread: true, isGroup: true,
    memberAvatars: ['🌸', '🎵', '🎸', '🌊'],
  },
  {
    id: 'g2', avatar: '📷',
    name: 'Photo walk crew',
    preview: 'ren: Meet at Shibuya station at 2pm?',
    time: '45m ago', unread: false, isGroup: true,
    memberAvatars: ['📸', '🎞️', '📷', '🌸'],
  },
  {
    id: 'g3', avatar: '☕',
    name: 'Late night coffee',
    preview: 'nagi: Anyone up for Daikanyama tonight?',
    time: '3h ago', unread: true, isGroup: true,
    memberAvatars: ['☕', '🖋️', '🌙'],
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
  isMutual: boolean;
}

// 自分がフォローしているハッシュタグ
export const FOLLOWED_HASHTAGS: string[] = [
  '#jprock',
  '#live',
  '#music',
  '#design',
  '#photo',
  '#night',
  '#coffee',
  '#minimal',
  '#film',
  '#engineer',
];

// ── Timeline フィード（フォロー中ハッシュタグの投稿） ──────────────
export const TIMELINE_POSTS: Post[] = [
  {
    id: 't1',
    avatar: '🌸',
    handle: '@yuki',
    name: 'yuki',
    content:
      "Watched tonight's live from the front row.\nCouldn't stop crying.\nThis is what music is all about.",
    hashtags: ['#jprock', '#live'],
    time: '2m ago',
    createdAt: _NOW - 2 * _MIN,
    expiresAt: _NOW - 2 * _MIN + 72 * _HR,
    isMutual: true,
  },
  {
    id: 't2',
    avatar: '🎨',
    handle: '@kai',
    name: 'kai',
    content:
      'Design is about subtracting, not adding.\nStrip it down, and what remains is the essence.',
    hashtags: ['#design', '#minimal'],
    time: '8m ago',
    createdAt: _NOW - 8 * _MIN,
    expiresAt: _NOW - 8 * _MIN + 24 * _HR,
    isMutual: false,
  },
  {
    id: 't3',
    avatar: '📸',
    handle: '@ren',
    name: 'ren',
    content:
      'Walked through rainy Shibuya for an hour.\nAmazing what you can capture with just a phone.',
    hashtags: ['#photo', '#night'],
    time: '23m ago',
    createdAt: _NOW - 23 * _MIN,
    expiresAt: _NOW - 23 * _MIN + 72 * _HR,
    isMutual: true,
  },
  {
    id: 't4',
    avatar: '☕',
    handle: '@nagi',
    name: 'nagi',
    content:
      '4th cup this morning already.\nRunning on caffeine and deadlines.\nNot hating this feeling.',
    hashtags: ['#coffee', '#minimal'],
    time: '1h ago',
    createdAt: _NOW - 1 * _HR,
    expiresAt: _NOW - 1 * _HR + 24 * _HR,
    isMutual: false,
  },
  {
    id: 't5',
    avatar: '🎵',
    handle: '@mio',
    name: 'mio',
    content:
      'Another 4 hours in the studio today.\nMusic really does make time disappear.',
    hashtags: ['#music', '#live'],
    time: '2h ago',
    createdAt: _NOW - 2 * _HR,
    expiresAt: _NOW - 2 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 't6',
    avatar: '🌊',
    handle: '@sora',
    name: 'sora',
    content:
      '深夜の散歩、最高だった。\n誰もいない街を歩くとき、頭の中がすっきりする。',
    hashtags: ['#night', '#music'],
    time: '3h ago',
    createdAt: _NOW - 3 * _HR,
    expiresAt: _NOW - 3 * _HR + 24 * _HR,
    isMutual: false,
  },
  {
    id: 't7',
    avatar: '💻',
    handle: '@mai',
    name: 'mai',
    content:
      'The satisfaction of fixing a bug\nfeels a bit like the afterglow of a live show.\nFought well today.',
    hashtags: ['#engineer'],
    time: '4h ago',
    createdAt: _NOW - 4 * _HR,
    expiresAt: _NOW - 4 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 't8',
    avatar: '🎞️',
    handle: '@tomo',
    name: 'tomo',
    content:
      'Brought my film camera back out.\nThat tension with every shot — digital just can\'t replicate it.',
    hashtags: ['#film', '#photo'],
    time: '5h ago',
    createdAt: _NOW - 5 * _HR,
    expiresAt: _NOW - 5 * _HR + 24 * _HR,
    isMutual: false,
  },
  {
    id: 't9',
    avatar: '🎸',
    handle: '@haru',
    name: 'haru',
    content:
      'Setlist was perfect last night.\nEvery song hit in exactly the right order.',
    hashtags: ['#jprock', '#live'],
    time: '6h ago',
    createdAt: _NOW - 6 * _HR,
    expiresAt: _NOW - 6 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 't10',
    avatar: '🖋️',
    handle: '@ao',
    name: 'ao',
    content:
      'When you talk about what you love,\nyour true self naturally comes out.',
    hashtags: ['#minimal'],
    time: '8h ago',
    createdAt: _NOW - 8 * _HR,
    expiresAt: _NOW - 8 * _HR + 24 * _HR,
    isMutual: false,
  },
  {
    id: 't11',
    avatar: '🌙',
    handle: '@luna',
    name: 'luna',
    content:
      'Empty streets at 2am with good music.\nThere\'s no better feeling.',
    hashtags: ['#night', '#music'],
    time: 'Yesterday',
    createdAt: _NOW - 20 * _HR,
    expiresAt: _NOW - 20 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 't12',
    avatar: '📷',
    handle: '@kei',
    name: 'kei',
    content:
      'Morning light through the window.\nThese are the shots I live for.',
    hashtags: ['#photo', '#minimal'],
    time: 'Yesterday',
    createdAt: _NOW - 20 * _HR,
    expiresAt: _NOW - 20 * _HR + 24 * _HR,
    isMutual: false,
  },
  // ── 非友達ユーザーの投稿（タイムライン多様性用） ────────────────
  {
    id: 't13',
    avatar: '💃',
    handle: '@kira_dance',
    name: 'kira',
    content: '今日のスタジオ、3時間ぶっ通しで踊った。\n体より先にメンタルが強くなった気がする。',
    hashtags: ['#dance', '#live'],
    time: '30m ago',
    createdAt: _NOW - 0.5 * _HR,
    expiresAt: _NOW - 0.5 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't14',
    avatar: '💃',
    handle: '@kira_dance',
    name: 'kira',
    content: '振り付けを覚えるより、\n音楽を感じることの方が大事だと思う。',
    hashtags: ['#music', '#dance'],
    time: '5h ago',
    createdAt: _NOW - 5 * _HR,
    expiresAt: _NOW - 5 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't15',
    avatar: '💃',
    handle: '@kira_dance',
    name: 'kira',
    content: '深夜の練習室、鏡の中の自分だけが相棒。\nそういう夜が一番好き。',
    hashtags: ['#night', '#dance'],
    time: 'Yesterday',
    createdAt: _NOW - 18 * _HR,
    expiresAt: _NOW - 18 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't16',
    avatar: '🎧',
    handle: '@ryu_beats',
    name: 'ryu',
    content: '新曲のビート、やっと形になってきた。\n言葉より先に音が語りかけてくる感覚。',
    hashtags: ['#music', '#jprock'],
    time: '2h ago',
    createdAt: _NOW - 2 * _HR,
    expiresAt: _NOW - 2 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't17',
    avatar: '🎧',
    handle: '@ryu_beats',
    name: 'ryu',
    content: 'スタジオに籠もった週末。\n外の世界とちょっと切り離されてる時間が一番クリエイティブ。',
    hashtags: ['#music', '#live'],
    time: '8h ago',
    createdAt: _NOW - 8 * _HR,
    expiresAt: _NOW - 8 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't18',
    avatar: '🎧',
    handle: '@ryu_beats',
    name: 'ryu',
    content: 'ヘッドフォンの中だけに存在する宇宙がある。\n今夜もそこに潜りに行く。',
    hashtags: ['#music', '#night'],
    time: '2d ago',
    createdAt: _NOW - 36 * _HR,
    expiresAt: _NOW - 36 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't19',
    avatar: '🌊',
    handle: '@sync_vibe',
    name: 'sync',
    content: '人と「同じ瞬間」を共有することの尊さ。\nSNSじゃ伝わらない何かがある。',
    hashtags: ['#live', '#night'],
    time: '1h ago',
    createdAt: _NOW - 1 * _HR,
    expiresAt: _NOW - 1 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't20',
    avatar: '🌊',
    handle: '@sync_vibe',
    name: 'sync',
    content: 'コーヒー片手に、ひとりの朝。\nこの静けさが一日をつくる。',
    hashtags: ['#coffee', '#minimal'],
    time: '6h ago',
    createdAt: _NOW - 6 * _HR,
    expiresAt: _NOW - 6 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't21',
    avatar: '🌊',
    handle: '@sync_vibe',
    name: 'sync',
    content: '夜中に読んだ本のページが\nまだ頭の中でうごめいている。',
    hashtags: ['#night', '#minimal'],
    time: 'Yesterday',
    createdAt: _NOW - 22 * _HR,
    expiresAt: _NOW - 22 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't22',
    avatar: '🎬',
    handle: '@mako_films',
    name: 'mako',
    content: '街を歩いてたら、映画みたいな光景に出くわした。\nカメラ持ってなかったのが悔しい。',
    hashtags: ['#photo', '#night'],
    time: '3h ago',
    createdAt: _NOW - 3 * _HR,
    expiresAt: _NOW - 3 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't23',
    avatar: '🎬',
    handle: '@mako_films',
    name: 'mako',
    content: '短編フィルムの編集、ようやく最終カット。\n見る人に何かを「感じさせる」作品にしたい。',
    hashtags: ['#photo', '#minimal'],
    time: '10h ago',
    createdAt: _NOW - 10 * _HR,
    expiresAt: _NOW - 10 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't24',
    avatar: '🎬',
    handle: '@mako_films',
    name: 'mako',
    content: '映像って、動く写真じゃなくて\n時間を切り取るものだと思う。',
    hashtags: ['#photo', '#live'],
    time: '2d ago',
    createdAt: _NOW - 40 * _HR,
    expiresAt: _NOW - 40 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't25',
    avatar: '✏️',
    handle: '@jun_design',
    name: 'jun',
    content: 'デザインって引き算だと思う。\n何を残すかより何を消すかの方が難しい。',
    hashtags: ['#design', '#minimal'],
    time: '4h ago',
    createdAt: _NOW - 4 * _HR,
    expiresAt: _NOW - 4 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't26',
    avatar: '✏️',
    handle: '@jun_design',
    name: 'jun',
    content: '余白のある暮らしがしたい。\nモノも情報も、本当に必要なものだけに。',
    hashtags: ['#design', '#minimal'],
    time: '12h ago',
    createdAt: _NOW - 12 * _HR,
    expiresAt: _NOW - 12 * _HR + 72 * _HR,
    isMutual: false,
  },
  {
    id: 't27',
    avatar: '✏️',
    handle: '@jun_design',
    name: 'jun',
    content: 'グリッドを崩した瞬間、\nレイアウトが呼吸をはじめた。',
    hashtags: ['#design', '#photo'],
    time: 'Yesterday',
    createdAt: _NOW - 28 * _HR,
    expiresAt: _NOW - 28 * _HR + 72 * _HR,
    isMutual: false,
  },
];

// ── Friends フィード（承認済みFriendsの投稿のみ） ─────────────────
export const FRIENDS_POSTS: Post[] = [
  {
    id: 'f1',
    avatar: '🌸',
    handle: '@yuki',
    name: 'yuki',
    content:
      "Last night's show was everything.\nThe setlist was so perfect I can barely remember it.",
    hashtags: ['#jprock', '#live'],
    time: '1h ago',
    createdAt: _NOW - 1 * _HR,
    expiresAt: _NOW - 1 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 'f2',
    avatar: '🎨',
    handle: '@kai',
    name: 'kai',
    content:
      'New design project started.\nWant to put depth inside the simplicity.',
    hashtags: ['#design', '#minimal'],
    time: '30m ago',
    createdAt: _NOW - 30 * _MIN,
    expiresAt: _NOW - 30 * _MIN + 72 * _HR,
    isMutual: true,
  },
  {
    id: 'f3',
    avatar: '🎵',
    handle: '@mio',
    name: 'mio',
    content:
      'Why do this band\'s lyrics hit so hard.\nThey put words to feelings I couldn\'t even name.',
    hashtags: ['#jprock', '#music'],
    time: '2h ago',
    createdAt: _NOW - 2 * _HR,
    expiresAt: _NOW - 2 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 'f4',
    avatar: '📸',
    handle: '@ren',
    name: 'ren',
    content:
      'Woke up early and headed to Yoyogi Park.\nThe light was perfect — shot 500 frames in an hour.',
    hashtags: ['#photo', '#minimal'],
    time: '45m ago',
    createdAt: _NOW - 45 * _MIN,
    expiresAt: _NOW - 45 * _MIN + 72 * _HR,
    isMutual: true,
  },
  {
    id: 'f5',
    avatar: '🎞️',
    handle: '@tomo',
    name: 'tomo',
    content:
      'Just developed my first roll in months.\nWaiting for prints is its own kind of excitement.',
    hashtags: ['#film', '#photo'],
    time: '3h ago',
    createdAt: _NOW - 3 * _HR,
    expiresAt: _NOW - 3 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 'f6',
    avatar: '🌸',
    handle: '@yuki',
    name: 'yuki',
    content:
      'Earphones in, empty park at night.\nHonestly my favorite feeling.',
    hashtags: ['#music', '#night'],
    time: '5h ago',
    createdAt: _NOW - 5 * _HR,
    expiresAt: _NOW - 5 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 'f7',
    avatar: '🎨',
    handle: '@kai',
    name: 'kai',
    content:
      'Even on off days I catch myself analyzing fonts and spacing on signs.\nOccupational hazard I guess.',
    hashtags: ['#design'],
    time: 'Yesterday',
    createdAt: _NOW - 20 * _HR,
    expiresAt: _NOW - 20 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 'f8',
    avatar: '📸',
    handle: '@ren',
    name: 'ren',
    content:
      'Brought my film camera back out.\nThat tension with every shot — digital just can\'t replicate it.',
    hashtags: ['#film', '#photo'],
    time: 'Yesterday',
    createdAt: _NOW - 22 * _HR,
    expiresAt: _NOW - 22 * _HR + 72 * _HR,
    isMutual: true,
  },
];

// ── 自分の投稿（プロフィール画面用） ─────────────────────────────
export const MY_POSTS: Post[] = [
  {
    id: 'my1',
    avatar: CURRENT_USER.avatar,
    handle: CURRENT_USER.handle,
    name: CURRENT_USER.name,
    content: 'Late night coding session with good music on loop.\nThis is the life.',
    hashtags: ['#engineer', '#music'],
    time: '1h ago',
    createdAt: _NOW - 1 * _HR,
    expiresAt: _NOW - 1 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 'my2',
    avatar: CURRENT_USER.avatar,
    handle: CURRENT_USER.handle,
    name: CURRENT_USER.name,
    content: 'Finally developed that film roll from last month.\nEvery single frame hit different.',
    hashtags: ['#film', '#photo'],
    time: '2h ago',
    createdAt: _NOW - 2 * _HR,
    expiresAt: _NOW - 2 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 'my3',
    avatar: CURRENT_USER.avatar,
    handle: CURRENT_USER.handle,
    name: CURRENT_USER.name,
    content: 'Third coffee of the morning.\nNot sorry about it.',
    hashtags: ['#coffee', '#minimal'],
    time: 'Yesterday',
    createdAt: _NOW - 20 * _HR,
    expiresAt: _NOW - 20 * _HR + 72 * _HR,
    isMutual: true,
  },
  {
    id: 'my4',
    avatar: CURRENT_USER.avatar,
    handle: CURRENT_USER.handle,
    name: CURRENT_USER.name,
    content: 'Empty streets at 2am.\nCity feels like it belongs to you.',
    hashtags: ['#night'],
    time: 'Yesterday',
    createdAt: _NOW - 22 * _HR,
    expiresAt: _NOW - 22 * _HR + 72 * _HR,
    isMutual: true,
  },
];

// ── Memory Calendar ───────────────────────────────────────────────
export type MemoryDayData = {
  posts: { id: string; text: string }[];
  savedPhotos: { id: string; url: string }[];
  newConnections: { id: string; name: string; username: string; avatar: string; userId: string }[];
  events: { id: string; name: string; eventId: string }[];
};

export const MEMORY_DATA: Record<string, MemoryDayData> = {
  '2026-03-27': {
    posts: [{ id: 'md1', text: '今日のライブ最高だった #jprock #live' }],
    savedPhotos: [{ id: 'sp1', url: '' }],
    newConnections: [{ id: 'nc1', name: 'hana', username: '@hana_night', avatar: '🌺', userId: 'hana' }],
    events: [{ id: 'ev1', name: '渋谷ライブイベント', eventId: 'e2' }],
  },
  '2026-03-20': {
    posts: [{ id: 'md2', text: '夜景きれい #night #photo' }],
    savedPhotos: [],
    newConnections: [],
    events: [],
  },
  '2026-03-15': {
    posts: [],
    savedPhotos: [{ id: 'sp2', url: '' }, { id: 'sp3', url: '' }],
    newConnections: [{ id: 'nc2', name: 'kai', username: '@kai_designs', avatar: '🎨', userId: 'kai' }],
    events: [{ id: 'ev2', name: 'SYNC LIVE 2026 × Shinjuku', eventId: 'e1' }],
  },
  '2026-03-10': {
    posts: [{ id: 'md3', text: '深夜のコーディング最高 #engineer #music' }],
    savedPhotos: [],
    newConnections: [],
    events: [],
  },
  '2026-03-05': {
    posts: [{ id: 'md4', text: '最近ずっとjprock聞いてる #jprock' }],
    savedPhotos: [{ id: 'sp4', url: '' }],
    newConnections: [
      { id: 'nc3', name: 'luna', username: '@luna_film', avatar: '🌙', userId: 'luna' },
      { id: 'nc4', name: 'tomo', username: '@tomo_music', avatar: '🎞️', userId: 'tomo' },
    ],
    events: [],
  },
};

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
    followersCount: 1240,
    eventsCount: 23,
    eventIds: ["e1"],
  },
  {
    id: "org-e2",
    name: "Photo Club SNAP",
    icon: "📷",
    desc: "A group sharing everyday photo opportunities",
    bio: "Whether you shoot with a smartphone or DSLR.",
    followersCount: 580,
    eventsCount: 14,
    eventIds: ["e2"],
  },
  {
    id: "org-e3",
    name: "Focus Session Tokyo",
    icon: "💻",
    desc: "Focused work community for engineers and designers",
    bio: "Late-night solo work is hard to sustain, but somehow it flows when done together.",
    followersCount: 920,
    eventsCount: 41,
    eventIds: ["e3"],
  },
  {
    id: "org-e4",
    name: "Late Night Coffee Club",
    icon: "☕",
    desc: "A minimal community that loves coffee and conversation",
    bio: "Late night only. A community for slow evenings with coffee and carefully chosen words.",
    followersCount: 310,
    eventsCount: 8,
    eventIds: ["e4"],
  },
  {
    id: "org-e5",
    name: "Design Philosophy Club",
    icon: "🎨",
    desc: "A community exploring the aesthetics of subtraction in design",
    bio: "\"What to remove\" over \"what to add\".",
    followersCount: 720,
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

export const HASHTAG_DATA: Record<string, HashtagEntry> = {
  "#jprock": {
    followers: 847,
    posts: [
      { id: "ht-r1", user: { name: "yuki",   handle: "@yuki_syncs",    avatar: "🌸" }, content: "Front row at today's live.\nCouldn't stop crying. This is what music is for.", time: "2h ago",  likes: 312, comments: 48 },
      { id: "ht-r2", user: { name: "tomo",   handle: "@tomo_music",    avatar: "🎸" }, content: "The bass hits your whole body.\nThis band is on a different level.", time: "4h ago",  likes: 187, comments: 23 },
      { id: "ht-r3", user: { name: "mio",    handle: "@mio_melody",    avatar: "🎵" }, content: "The setlist was perfect, I knew every song.\nDefinitely coming back next year.", time: "1d ago",    likes: 256, comments: 38 },
      { id: "ht-r4", user: { name: "azusa",  handle: "@azusa_piano",   avatar: "🎹" }, content: "Growing up on jprock, I'm so happy to see the new wave of bands rising.", time: "2d ago", likes: 94, comments: 11 },
      { id: "ht-r5", user: { name: "kanon",  handle: "@kanon_strings", avatar: "🎻" }, content: "Music delivers what words\ncannot express.", time: "3d ago", likes: 143, comments: 19 },
    ],
  },
  "#live": {
    followers: 612,
    posts: [
      { id: "ht-l1", user: { name: "yuki",  handle: "@yuki_syncs", avatar: "🌸" }, content: "Everyone in this space feeling the same thing,\nshaking together. This is what lives are about.", time: "1h ago", likes: 428, comments: 62 },
      { id: "ht-l2", user: { name: "nana",  handle: "@nana_voice",  avatar: "🎤" }, content: "Screamed until my voice gave out.\nBest night ever.", time: "3h ago", likes: 315, comments: 44 },
      { id: "ht-l3", user: { name: "kanon", handle: "@kanon_strings", avatar: "🎻" }, content: "3 encores.\nNobody wanted to leave.", time: "5h ago", likes: 201, comments: 34 },
      { id: "ht-l4", user: { name: "mio",   handle: "@mio_melody",  avatar: "🎵" }, content: "I want to stay here forever.\nMay this feeling last.", time: "1d ago", likes: 178, comments: 27 },
    ],
  },
  "#photo": {
    followers: 1203,
    posts: [
      { id: "ht-p1", user: { name: "ren",     handle: "@ren_frames",   avatar: "📸" }, content: "Walked rainy Shibuya for an hour.\nAmazing that one phone can capture a world like this.", time: "30m ago", likes: 428, comments: 62 },
      { id: "ht-p2", user: { name: "hana",    handle: "@hana_night",   avatar: "🌺" }, content: "When shooting night scenes, I love the moment\nsomeone steps into the frame.", time: "2h ago", likes: 203, comments: 31 },
      { id: "ht-p3", user: { name: "sena",    handle: "@sena_snap",    avatar: "📷" }, content: "Daily snapshots pile up\nand become your own history.", time: "4h ago", likes: 156, comments: 22 },
      { id: "ht-p4", user: { name: "satsuki", handle: "@satsuki_rain", avatar: "🌧" }, content: "Rainy day photos have a different color.\nEvery reflection of light becomes art.", time: "1d ago", likes: 311, comments: 47 },
      { id: "ht-p5", user: { name: "kokona",  handle: "@kokona_tulip", avatar: "🌷" }, content: "I love minimal compositions.\nAll I think about is where to place the empty space.", time: "2d ago", likes: 189, comments: 28 },
    ],
  },
  "#design": {
    followers: 534,
    posts: [
      { id: "ht-d1", user: { name: "kai",    handle: "@kai_designs",  avatar: "🎨" }, content: "Design is about subtracting, not adding.\nStrip it away until only the essence remains.", time: "1h ago", likes: 187, comments: 31 },
      { id: "ht-d2", user: { name: "misato", handle: "@misato_color",  avatar: "🌈" }, content: "A single color placement\ncan change how someone feels.", time: "3h ago", likes: 142, comments: 18 },
      { id: "ht-d3", user: { name: "nozomi", handle: "@nozomi_art",    avatar: "🎨" }, content: "The line between design and art\nis who it's made for.", time: "6h ago", likes: 98, comments: 15 },
      { id: "ht-d4", user: { name: "makoto", handle: "@makoto_dev",    avatar: "💻" }, content: "I'm an engineer but I love design too.\nBeauty can be created with code.", time: "1d ago", likes: 134, comments: 21 },
    ],
  },
  "#coffee": {
    followers: 489,
    posts: [
      { id: "ht-c1", user: { name: "nagi",    handle: "@nagi_brews",   avatar: "☕" }, content: "Late-night coffee isn't loneliness,\nit's a conversation.", time: "2h ago", likes: 203, comments: 34 },
      { id: "ht-c2", user: { name: "ao",      handle: "@ao_writes",    avatar: "🖊️" }, content: "Words written over coffee\nstrangely become more honest.", time: "5h ago", likes: 156, comments: 22 },
      { id: "ht-c3", user: { name: "mashiro", handle: "@mashiro_pure", avatar: "🐧" }, content: "I love the scent of freshly ground beans.\nThe ritual that starts my day.", time: "1d ago", likes: 289, comments: 41 },
      { id: "ht-c4", user: { name: "hinata",  handle: "@hinata_cafe",  avatar: "🌸" }, content: "Tucked in the corner of my favorite cafe,\ncoffee in hand, time just stops.", time: "2d ago", likes: 178, comments: 26 },
    ],
  },
  "#engineer": {
    followers: 376,
    posts: [
      { id: "ht-e1", user: { name: "makoto", handle: "@makoto_dev",   avatar: "💻" }, content: "The satisfaction of fixing a bug\nis unlike anything else.", time: "1h ago", likes: 312, comments: 55 },
      { id: "ht-e2", user: { name: "takumi", handle: "@takumi_craft", avatar: "🔨" }, content: "I think code is poetry.\nThere's beauty in reading it and writing it.", time: "4h ago", likes: 198, comments: 33 },
      { id: "ht-e3", user: { name: "kai",    handle: "@kai_designs",  avatar: "🎨" }, content: "I want to be someone who can do\nboth design and engineering.", time: "1d ago", likes: 145, comments: 24 },
    ],
  },
  "#words": {
    followers: 701,
    posts: [
      { id: "ht-w1", user: { name: "ao",     handle: "@ao_writes",    avatar: "🖊️" }, content: "When I talk about things I love,\nmy true self naturally comes out.", time: "2h ago", likes: 95, comments: 17 },
      { id: "ht-w2", user: { name: "rio",    handle: "@rio_words",    avatar: "✍️" }, content: "I want to expand the world through words.\nIf even one line reaches someone, that's enough.", time: "4h ago", likes: 211, comments: 38 },
      { id: "ht-w3", user: { name: "hitomi", handle: "@hitomi_reads", avatar: "📖" }, content: "With books, films, and words,\nI can travel anywhere.", time: "7h ago", likes: 167, comments: 25 },
      { id: "ht-w4", user: { name: "yumi",   handle: "@yumi_books",   avatar: "📚" }, content: "When I read a favorite passage aloud,\nsomething inside me stirs.", time: "1d ago", likes: 134, comments: 19 },
    ],
  },
  "#minimal": {
    followers: 423,
    posts: [
      { id: "ht-m1", user: { name: "ao",     handle: "@ao_writes",    avatar: "🖊️" }, content: "Surrounded by fewer things,\nmy mind gets quieter too.", time: "3h ago", likes: 178, comments: 28 },
      { id: "ht-m2", user: { name: "yoko",   handle: "@yoko_zen",     avatar: "🧘" }, content: "Each time I let something go,\nI see more clearly what I truly need.", time: "6h ago", likes: 234, comments: 35 },
      { id: "ht-m3", user: { name: "nagi",   handle: "@nagi_brews",   avatar: "☕" }, content: "Drinking coffee in a minimal space.\nThat alone makes the day complete.", time: "1d ago", likes: 156, comments: 22 },
    ],
  },
  "#music": {
    followers: 956,
    posts: [
      { id: "ht-mu1", user: { name: "tomo",  handle: "@tomo_music",    avatar: "🎸" }, content: "Music transcends language.\nIt resonates regardless of nationality or age.", time: "1h ago", likes: 445, comments: 67 },
      { id: "ht-mu2", user: { name: "kira",  handle: "@kira_dance",    avatar: "⭐" }, content: "I've become someone\nwho can't get through a single day without music.", time: "3h ago", likes: 312, comments: 51 },
      { id: "ht-mu3", user: { name: "azusa", handle: "@azusa_piano",   avatar: "🎹" }, content: "When I play piano,\nemotion turns into sound before words.", time: "5h ago", likes: 267, comments: 44 },
      { id: "ht-mu4", user: { name: "nana",  handle: "@nana_voice",    avatar: "🎤" }, content: "Singing is how I first understand\nwhat I'm actually feeling.", time: "1d ago", likes: 198, comments: 33 },
    ],
  },
  "#nightview": {
    followers: 318,
    posts: [
      { id: "ht-n1", user: { name: "hana",    handle: "@hana_night",    avatar: "🌺" }, content: "Walking while looking at the night view,\nsomehow I always feel like crying.", time: "2h ago", likes: 287, comments: 43 },
      { id: "ht-n2", user: { name: "luna",    handle: "@luna_film",     avatar: "🌙" }, content: "I love when a film's night scene\noverlaps with the real thing.", time: "4h ago", likes: 203, comments: 31 },
      { id: "ht-n3", user: { name: "suzuha",  handle: "@suzuha_moon",   avatar: "🌙" }, content: "Looking at the night view,\nI feel the vastness of the world.", time: "1d ago", likes: 156, comments: 24 },
    ],
  },
  "#travel": {
    followers: 782,
    posts: [
      { id: "ht-t1", user: { name: "sora_k",  handle: "@sora_sky",     avatar: "🌊" }, content: "The once-in-a-lifetime encounters\nI've had while traveling have changed my life.", time: "30m ago", likes: 334, comments: 52 },
      { id: "ht-t2", user: { name: "rika",    handle: "@rika_run",     avatar: "🏃" }, content: "Running and traveling are similar.\nThe meaning is in the journey, not the destination.", time: "2h ago", likes: 189, comments: 29 },
      { id: "ht-t3", user: { name: "momoka",  handle: "@momoka_peach", avatar: "🍑" }, content: "Eating something delicious while traveling\nmakes me grateful to be alive.", time: "5h ago", likes: 267, comments: 41 },
    ],
  },
  "#nature": {
    followers: 641,
    posts: [
      { id: "ht-na1", user: { name: "sora_k", handle: "@sora_sky",   avatar: "🌊" }, content: "The view from the mountain top\nleft me speechless.", time: "1h ago", likes: 412, comments: 63 },
      { id: "ht-na2", user: { name: "kotone", handle: "@kotone_sky", avatar: "🦋" }, content: "In the sky and nature,\nI always feel the answers are there.", time: "3h ago", likes: 256, comments: 38 },
      { id: "ht-na3", user: { name: "yua",    handle: "@yua_garden", avatar: "🌻" }, content: "Going outside and touching the soil,\nall the excess just stops mattering.", time: "6h ago", likes: 178, comments: 26 },
    ],
  },
  "#festival": {
    followers: 521,
    posts: [
      { id: "ht-fes1", user: { name: "yuki",  handle: "@yuki_syncs",  avatar: "🌸" }, content: "Festival food and music are both perfect.\nI come every year for this atmosphere.", time: "2h ago", likes: 334, comments: 52 },
      { id: "ht-fes2", user: { name: "tomo",  handle: "@tomo_music",  avatar: "🎸" }, content: "The distant sound heard from inside a tent\nstays with me forever.", time: "5h ago", likes: 201, comments: 33 },
    ],
  },
  "#band": {
    followers: 445,
    posts: [
      { id: "ht-ba1", user: { name: "tomo",  handle: "@tomo_music",    avatar: "🎸" }, content: "I love the moment when a band's sound becomes one.\nThe feeling when everyone breathes together.", time: "1h ago", likes: 267, comments: 41 },
      { id: "ht-ba2", user: { name: "azusa", handle: "@azusa_piano",   avatar: "🎹" }, content: "Being in a band teaches you\nmore than just music.", time: "4h ago", likes: 198, comments: 28 },
    ],
  },
  "#night": {
    followers: 534,
    posts: [
      { id: "ht-ni1", user: { name: "luna",   handle: "@luna_film",    avatar: "🌙" }, content: "At night\na different version of me comes out.", time: "2h ago", likes: 312, comments: 48 },
      { id: "ht-ni2", user: { name: "ao",     handle: "@ao_writes",    avatar: "🖊️" }, content: "Words I write at midnight\nlook completely different in the morning.", time: "5h ago", likes: 198, comments: 31 },
    ],
  },
  "#art": {
    followers: 398,
    posts: [
      { id: "ht-ar1", user: { name: "nozomi", handle: "@nozomi_art",   avatar: "🎨" }, content: "Art starts with \"I don't get it\".\nThe moment you try to understand, something begins.", time: "3h ago", likes: 201, comments: 32 },
      { id: "ht-ar2", user: { name: "luna",   handle: "@luna_film",    avatar: "🌙" }, content: "I see films, music, and design\nall as art.", time: "1d ago", likes: 156, comments: 23 },
    ],
  },
  "#cafe": {
    followers: 634,
    posts: [
      { id: "ht-ca1", user: { name: "hinata", handle: "@hinata_cafe",  avatar: "🌸" }, content: "Cafe-hopping shows you\na different face of the city.", time: "1h ago", likes: 312, comments: 49 },
      { id: "ht-ca2", user: { name: "nagi",   handle: "@nagi_brews",   avatar: "☕" }, content: "Late-night cafes have people\nwho only come at that hour.", time: "4h ago", likes: 223, comments: 35 },
    ],
  },
  "#movie": {
    followers: 567,
    posts: [
      { id: "ht-mv1", user: { name: "luna",   handle: "@luna_film",    avatar: "🌙" }, content: "Those 2 hours inside a film\nare when I'm most honest with myself.", time: "1h ago", likes: 289, comments: 45 },
      { id: "ht-mv2", user: { name: "mika",   handle: "@mika_cinema",  avatar: "🎬" }, content: "Through movies\nI get to live the lives of people I've never met.", time: "3h ago", likes: 212, comments: 34 },
    ],
  },
  "#reading": {
    followers: 412,
    posts: [
      { id: "ht-bk1", user: { name: "yumi",   handle: "@yumi_books",   avatar: "📚" }, content: "I live inside books.\nEvery page turn takes me to another world.", time: "2h ago", likes: 198, comments: 31 },
      { id: "ht-bk2", user: { name: "hitomi", handle: "@hitomi_reads", avatar: "📖" }, content: "I feel like every book I read\nexpands who I am a little more.", time: "1d ago", likes: 156, comments: 22 },
    ],
  },
  "#sports": {
    followers: 389,
    posts: [
      { id: "ht-sp2", user: { name: "rika",   handle: "@rika_run",     avatar: "🏃" }, content: "That clarity after moving your body\nis unlike anything else.", time: "1h ago", likes: 223, comments: 35 },
    ],
  },
  "#fashion": {
    followers: 478,
    posts: [
      { id: "ht-fa1", user: { name: "sumire", handle: "@sumire_violet", avatar: "💜" }, content: "Clothes are the easiest way to shift your mood.\nI love the choice every morning.", time: "2h ago", likes: 267, comments: 41 },
    ],
  },
  "#dance": {
    followers: 356,
    posts: [
      { id: "ht-da1", user: { name: "kira",   handle: "@kira_dance",   avatar: "⭐" }, content: "Dancing has become like breathing.\nI can't stop.", time: "1h ago", likes: 234, comments: 37 },
    ],
  },
};

export const USER_TAGS: Record<string, string[]> = {
  "@yuki_syncs":    ["#jprock", "#live"],
  "@tomo_music":    ["#band", "#music"],
  "@mio_melody":    ["#music", "#live"],
  "@azusa_piano":   ["#music", "#jprock"],
  "@kanon_strings": ["#music", "#live"],
  "@nana_voice":    ["#music", "#live"],
  "@ren_frames":    ["#photo", "#nature"],
  "@hana_night":    ["#photo", "#nightview"],
  "@sena_snap":     ["#photo", "#design"],
  "@satsuki_rain":  ["#photo", "#night"],
  "@kokona_tulip":  ["#photo", "#minimal"],
  "@kai_designs":   ["#design", "#engineer"],
  "@misato_color":  ["#design", "#illustration"],
  "@nozomi_art":    ["#design", "#art"],
  "@makoto_dev":    ["#engineer", "#design"],
  "@nagi_brews":    ["#coffee", "#minimal"],
  "@ao_writes":     ["#words", "#coffee"],
  "@mashiro_pure":  ["#coffee"],
  "@hinata_cafe":   ["#cafe", "#coffee"],
  "@takumi_craft":  ["#engineer"],
  "@kira_dance":    ["#music", "#dance"],
  "@rio_words":     ["#words"],
  "@hitomi_reads":  ["#words", "#reading"],
  "@yumi_books":    ["#words", "#reading"],
  "@yoko_zen":      ["#minimal"],
  "@sora_sky":      ["#nature", "#travel"],
  "@kotone_sky":    ["#nature"],
  "@yua_garden":    ["#nature"],
  "@luna_film":     ["#movie", "#nightview"],
  "@suzuha_moon":   ["#nightview"],
  "@rika_run":      ["#sports", "#travel"],
  "@momoka_peach":  ["#travel"],
  "@mika_cinema":   ["#movie"],
  "@sumire_violet": ["#fashion"],
  "@sota_beats":    ["#music", "#dance"],
  "@sara_earth":    ["#cooking"],
};
