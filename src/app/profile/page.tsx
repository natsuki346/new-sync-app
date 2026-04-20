'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getFriends } from '@/lib/friendship';
import { CURRENT_USER, MEMORY_DATA, type Post, type MemoryDayData, type Reaction } from '@/lib/mockData';
import { PassionGraph, MY_PASSION } from '@/components/PassionGraph';
import { RAINBOW } from '@/lib/rainbow';

// ── 友達型 ────────────────────────────────────────────────────────
type Friend = {
  id:       string;
  name:     string;   // display_name
  handle:   string;   // @username
  username: string;   // raw username（ルーティング用）
  avatar:   string;
};

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day  = Math.floor(diff / 86400000);
  if (min  < 1)  return 'たった今';
  if (min  < 60) return `${min}分前`;
  if (hour < 24) return `${hour}時間前`;
  return `${day}日前`;
}

// ── 友達ボトムシート（索引付き） ─────────────────────────────────

function getJaGroup(name: string): string {
  const c = name[0];
  if (/[ぁ-お]/.test(c)) return 'あ';
  if (/[か-ご]/.test(c)) return 'か';
  if (/[さ-ぞ]/.test(c)) return 'さ';
  if (/[た-ど]/.test(c)) return 'た';
  if (/[な-の]/.test(c)) return 'な';
  if (/[は-ぽ]/.test(c)) return 'は';
  if (/[ま-も]/.test(c)) return 'ま';
  if (/[ゃ-よ]/.test(c)) return 'や';
  if (/[ら-ろ]/.test(c)) return 'ら';
  if (/[ゎ-ん]/.test(c)) return 'わ';
  if (/[ア-ン]/.test(c)) return 'ア';
  return c.toUpperCase();
}

function FriendsSheet({ onClose, friends, loading }: {
  onClose:  () => void;
  friends:  Friend[];
  loading:  boolean;
}) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const router = useRouter();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const isSearching = searchQuery.trim().length > 0;

  const filtered = friends.filter((f) => {
    const q = searchQuery.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.handle.toLowerCase().includes(q);
  });
  const sorted = [...filtered].sort((a, b) =>
    a.name.localeCompare(b.name, 'ja', { sensitivity: 'base' })
  );

  const grouped = sorted.reduce<Record<string, Friend[]>>((acc, f) => {
    const key = getJaGroup(f.name);
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});
  const sections = Object.keys(grouped).sort((a, b) =>
    a.localeCompare(b, 'ja', { sensitivity: 'base' })
  );

  const scrollToSection = (key: string) => {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <div
        className="absolute inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col sheet-animate"
        style={{
          background: 'var(--background)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '85%',
          borderTop: '1px solid var(--surface-2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ハンドル + タイトル */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="w-8 h-1 rounded-full mx-auto mb-3" style={{ background: 'var(--surface-2)' }} />
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
              {t('friends')} ({friends.length})
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full active:scale-90 transition-transform"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" style={{ color: 'var(--muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 検索バー */}
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="flex items-center rounded-full gap-2 px-3 py-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tc('search')}
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: 'var(--foreground)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="flex-shrink-0 active:scale-90">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" style={{ color: 'var(--muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* リスト + 索引バー */}
        <div className="flex flex-1 min-h-0 relative">
          {/* 友達リスト */}
          <div className="overflow-y-auto flex-1 pr-6 pb-8">
            {loading ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>
              </div>
            ) : isSearching ? (
              sorted.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-5 py-3 cursor-pointer active:opacity-70"
                  style={{ borderBottom: '1px solid var(--surface-2)' }}
                  onClick={() => router.push(`/profile/${f.username}`)}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: 'var(--surface-2)' }}>
                    {f.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{f.name}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{f.handle}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/chat/${f.id}`); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full active:scale-90 transition-transform flex-shrink-0"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" style={{ color: 'var(--muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                </div>
              ))
            ) : (
              sections.map((section) => (
                <div key={section} ref={(el) => { sectionRefs.current[section] = el; }}>
                  <div className="px-5 py-1 sticky top-0 z-10" style={{ background: 'rgba(14,14,26,0.9)' }}>
                    <span className="text-[11px] font-bold" style={{ color: 'var(--muted)' }}>{section}</span>
                  </div>
                  {grouped[section].map((f) => (
                    <div key={f.id} className="flex items-center gap-3 px-5 py-3 cursor-pointer active:opacity-70"
                      style={{ borderBottom: '1px solid var(--surface-2)' }}
                      onClick={() => router.push(`/profile/${f.username}`)}>
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: 'var(--surface-2)' }}>
                        {f.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{f.name}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{f.handle}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/chat/${f.id}`); }}
                        className="w-8 h-8 flex items-center justify-center rounded-full active:scale-90 transition-transform flex-shrink-0"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" style={{ color: 'var(--muted)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
            {sorted.length === 0 && (
              <p className="text-center text-sm py-8" style={{ color: 'var(--muted)' }}>{t('notFound')}</p>
            )}
          </div>

          {/* 右側索引バー（検索中は非表示） */}
          {!isSearching && sections.length > 0 && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 z-10 py-2">
              {sections.map((section) => (
                <button
                  key={section}
                  onClick={() => scrollToSection(section)}
                  className="text-[10px] font-bold w-5 h-5 flex items-center justify-center active:scale-90 transition-transform"
                  style={{ color: '#E63946' }}
                >
                  {section}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── ハッシュタグサジェスト ────────────────────────────────────────
const SUGGEST_TAGS = [
  '#jprock', '#live', '#photo', '#nightview', '#design',
  '#art', '#minimal', '#coffee', '#cafe', '#engineer',
  '#words', '#film', '#music', '#band', '#sports',
  '#travel', '#food', '#fashion', '#reading', '#nature',
  '#cooking', '#dance', '#DJ', '#night', '#baseball',
  '#soccer', '#athletics', '#youth', '#challenge', '#gaming',
];

// ── HashtagManagerModal ───────────────────────────────────────────

function HashtagManagerModal({ onClose }: {
  onClose: () => void;
}) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const { user, followedHashtags, followHashtag, unfollowHashtag } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  type OwnerPhase = 'none' | 'owner_screen' | 'animating' | 'owned';
  const [ownerPhase, setOwnerPhase] = useState<OwnerPhase>('none');
  const [ownerTag, setOwnerTag] = useState('');

  const tags        = followedHashtags;
  const query       = searchQuery.replace(/^#/, '').trim();
  const suggestions = query === '' ? SUGGEST_TAGS : SUGGEST_TAGS.filter((t) => t.includes(query));
  const customTag   = query.length > 0 ? `#${query}` : null;
  const showCustom  = customTag !== null && !SUGGEST_TAGS.includes(customTag) && !tags.includes(customTag);

  const addTag = async (tag: string) => {
    const n = tag.startsWith('#') ? tag : `#${tag}`;
    if (n.length <= 1 || tags.includes(n)) return;

    // フォロワー0・既存タグなしならオーナー画面を表示
    const { count } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'hashtag')
      .eq('tag', n);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: engRow } = await (supabase.from('hashtag_engagements') as any)
      .select('tag').eq('tag', n).limit(1).maybeSingle();

    if ((count ?? 0) === 0 && engRow === null) {
      setOwnerTag(n);
      setOwnerPhase('owner_screen');
    } else {
      await followHashtag(n);

      // タグ追加後にフォロワー数をチェック（自分が最初なら is_owner を立てる）
      const { count: postFollowCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'hashtag')
        .eq('tag', n);
      if ((postFollowCount ?? 0) <= 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('hashtag_engagements') as any).upsert({
          user_id:        user?.id,
          tag:            n,
          is_owner:       true,
          post_count:     0,
          reaction_count: 0,
        }, { onConflict: 'user_id,tag' });
      }
    }
    setSearchQuery('');
  };

  const handleBecomeOwner = async () => {
    if (!user) return;
    await followHashtag(ownerTag);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('hashtag_engagements') as any).upsert({
      user_id:        user.id,
      tag:            ownerTag,
      is_owner:       true,
      post_count:     0,
      reaction_count: 0,
    }, { onConflict: 'user_id,tag' });
    setOwnerPhase('animating');
    setTimeout(() => setOwnerPhase('owned'), 1500);
  };

  const removeTag = (tag: string) => unfollowHashtag(tag);

  if (ownerPhase === 'owner_screen' || ownerPhase === 'animating') {
    return (
      <>
        <div
          className="absolute inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
          onClick={ownerPhase === 'owner_screen' ? () => setOwnerPhase('none') : undefined}
        />
        <div
          className="absolute bottom-0 left-0 right-0 z-50 sheet-animate flex flex-col"
          style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', maxHeight: 'calc(100% - 80px)', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {ownerPhase === 'owner_screen' ? (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <span style={{ border: '1px solid white', borderRadius: '9999px', padding: '4px 16px', fontSize: '1rem', color: 'white' }}>
                {ownerTag}
              </span>
              <p className="text-white text-xl font-bold">最初のオーナーになろう</p>
              <p className="text-gray-400 text-sm text-center px-8">
                このタグをフォローして、コミュニティの最初のメンバーになれます
              </p>
              <p className="text-gray-500 text-sm">0 Following</p>
              <button
                onClick={handleBecomeOwner}
                className="bg-white text-black font-bold px-8 py-3 rounded-full text-sm"
              >
                オーナーになる
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <p className="text-white text-2xl font-bold animate-pulse">🎉</p>
              <p className="text-white text-lg font-bold">オーナーになりました！</p>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className="absolute inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div
        className="absolute bottom-0 left-0 right-0 z-50 sheet-animate flex flex-col"
        style={{
          background: 'var(--surface)',
          borderRadius: '16px 16px 0 0',
          maxHeight: 'calc(100% - 80px)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>
        <div className="flex items-center justify-between px-5 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--surface-2)' }}>
          <h2 className="font-bold text-base" style={{ color: 'var(--foreground)' }}>{t('followingHashtags')}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg active:scale-90 transition-transform"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)', color: 'var(--muted)' }}
          >
            ×
          </button>
        </div>
        <div className="px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--surface-2)' }}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: 'var(--muted)' }}>#</span>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && query.length > 0) addTag(query); }}
              placeholder={tc('search')}
              className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'rgba(230,57,70,0.4)', border: '1px solid', color: 'var(--foreground)' }}
            />
          </div>
          {searchQuery.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {showCustom && (
                <button onClick={() => addTag(query)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border font-bold active:scale-95"
                  style={{ background: 'rgba(230,57,70,0.1)', borderColor: '#E63946', color: '#E63946' }}>
                  <span>＋</span><span>Add {customTag}</span>
                </button>
              )}
              {suggestions.filter((t) => !tags.includes(t)).slice(0, 12).map((tag) => (
                <button key={tag} onClick={() => addTag(tag)}
                  className="text-xs px-3 py-1.5 rounded-full border font-medium active:scale-95"
                  style={{ background: 'var(--surface)', borderColor: 'var(--surface-2)', color: 'var(--muted)' }}>
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 pt-4 pb-10">
          {tags.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('noTags')}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(136,136,170,0.5)' }}>{t('addTagHint')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {tags.map((tag) => (
                <div key={tag} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #E63946, #C41A27)', color: '#fff' }}>
                    #
                  </div>
                  <p className="flex-1 text-sm font-bold" style={{ color: 'var(--foreground)' }}>{tag}</p>
                  <button onClick={() => removeTag(tag)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-base active:scale-90 transition-transform"
                    style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)', color: 'var(--muted)' }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── 型 ────────────────────────────────────────────────────────────
type TabKey = 'posts' | 'memory';

// ── カレンダー ────────────────────────────────────────────────────
const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// プロフィール編集モーダル
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const AVATAR_OPTIONS = ['✨', '🌸', '🎵', '🎨', '📸', '🌙', '☕', '🎸', '🌊', '💻', '🖋️', '🎞️'];


async function uploadImage(file: File, bucket: string, userId: string): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true })
  if (error) {
    console.error('upload error:', error)
    return null
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

function EditModal({
  name, handle, bio, avatar, avatarUrl: initAvatarUrl, headerUrl: initHeaderUrl, user,
  onSave, onClose,
}: {
  name: string; handle: string; bio: string; avatar: string;
  avatarUrl: string; headerUrl: string;
  user: { id: string } | null;
  onSave: (d: { name: string; handle: string; bio: string; avatar: string; avatarUrl: string; headerUrl: string }) => void;
  onClose: () => void;
}) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const [dName,          setDName]          = useState(name);
  const [dHandle,        setDHandle]        = useState(handle);
  const [dBio,           setDBio]           = useState(bio);
  const [dAvatar,        setDAvatar]        = useState(avatar);
  const [avatarUrl,      setAvatarUrl]      = useState(initAvatarUrl);
  const [headerUrl,      setHeaderUrl]      = useState(initHeaderUrl);

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* モーダル本体 */}
      <div
        className="absolute bottom-0 left-0 right-0 z-50 sheet-animate flex flex-col"
        style={{
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '85%',
          overflowY: 'auto',
        }}
      >
        {/* ハンドル */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--surface-2)' }} />
        </div>

        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--surface-2)' }}
        >
          <button
            className="text-sm active:opacity-60 transition-opacity"
            style={{ color: 'var(--muted)' }}
            onClick={onClose}
          >
            {tc('cancel')}
          </button>
          <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            {t('editTitle')}
          </p>
          <button
            className="text-sm font-bold active:opacity-60 transition-opacity"
            style={{ color: 'var(--brand)' }}
            onClick={() => onSave({ name: dName, handle: dHandle, bio: dBio, avatar: dAvatar, avatarUrl, headerUrl })}
          >
            {tc('save')}
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-5">
          {/* アイコン画像 */}
          <div style={{ marginBottom: 4 }}>
            <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>アイコン画像</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                overflow: 'hidden', background: '#222',
                border: '2px solid #444', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {avatarUrl ? (
                  <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
                ) : (
                  <span style={{ fontSize: 28 }}>{dAvatar}</span>
                )}
              </div>
              <label style={{
                background: '#333', color: '#fff', padding: '8px 16px',
                borderRadius: 8, fontSize: 13, cursor: 'pointer', border: '1px solid #444'
              }}>
                写真を選択
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file || !user) return
                    const url = await uploadImage(file, 'avatars', user.id)
                    if (url) setAvatarUrl(url)
                  }}
                />
              </label>
              {avatarUrl && (
                <button
                  onClick={() => setAvatarUrl('')}
                  style={{ color: '#9ca3af', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  削除
                </button>
              )}
            </div>
          </div>

          {/* ヘッダー画像 */}
          <div style={{ marginBottom: 4 }}>
            <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>ヘッダー画像</p>
            <div style={{ position: 'relative', width: '100%', height: 80, background: '#222', borderRadius: 8, overflow: 'hidden', border: '1px solid #444' }}>
              {headerUrl ? (
                <img src={headerUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="header" />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13 }}>
                  ヘッダー画像なし
                </div>
              )}
              <label style={{
                position: 'absolute', bottom: 8, right: 8,
                background: 'rgba(0,0,0,0.7)', color: '#fff',
                padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer'
              }}>
                写真を選択
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file || !user) return
                    const url = await uploadImage(file, 'headers', user.id)
                    if (url) setHeaderUrl(url)
                  }}
                />
              </label>
            </div>
          </div>

          {/* アバター選択 */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted)' }}>
              {t('icon')}
            </p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av}
                  onClick={() => setDAvatar(av)}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-2xl transition-all active:scale-90"
                  style={{
                    background: dAvatar === av ? 'rgba(255,26,26,0.15)' : 'var(--surface-2)',
                    border: dAvatar === av ? '2px solid var(--brand)' : '2px solid transparent',
                  }}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* 名前 */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>{t('name')}</p>
            <input
              value={dName}
              onChange={(e) => setDName(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--surface-2)',
                color: 'var(--foreground)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,26,26,0.4)')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--surface-2)')}
            />
          </div>

          {/* ハンドル */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>{t('handle')}</p>
            <input
              value={dHandle}
              onChange={(e) => setDHandle(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--surface-2)',
                color: 'var(--foreground)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,26,26,0.4)')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--surface-2)')}
            />
          </div>

          {/* 自己紹介 */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>{t('bio')}</p>
            <textarea
              value={dBio}
              onChange={(e) => setDBio(e.target.value)}
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--surface-2)',
                color: 'var(--foreground)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,26,26,0.4)')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--surface-2)')}
            />
          </div>

        </div>

        <div className="h-8" />
      </div>
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// プロフィールページ本体
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ProfilePage() {
  const t = useTranslations('profile');
  const router = useRouter();
  const { user, refreshProfile, followedHashtags } = useAuth();

  const [name,      setName]      = useState(CURRENT_USER.name);
  const [handle,    setHandle]    = useState(CURRENT_USER.handle);
  const [bio,       setBio]       = useState(CURRENT_USER.bio);
  const [avatar,    setAvatar]    = useState(CURRENT_USER.avatar);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [headerUrl, setHeaderUrl] = useState('');
  const [editing,        setEditing]        = useState(false);
  const [activeTab,      setActiveTab]      = useState<TabKey>('posts');
  const [showFriends,    setShowFriends]    = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [pinnedIds,      setPinnedIds]      = useState<string[]>([]);
  const [pinToast,       setPinToast]       = useState('');
  const [hashtagColor,   setHashtagColor]   = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('sync_hashtag_color') || '';
  });

  // ── 投稿リスト ─────────────────────────────────────────────────
  const [myPosts,       setMyPosts]       = useState<Post[]>([]);
  const [postsLoading,  setPostsLoading]  = useState(true);

  // ── 友達リスト ─────────────────────────────────────────────────
  const [friends,       setFriends]       = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  // Supabase からプロフィールを初期読み込み
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('profiles')
      .select('display_name, username, bio, avatar_url, header_url')
      .eq('id', user.id)
      .single()
      .then(({ data }: { data: any }) => {
        if (data) {
          setName(data.display_name ?? '');
          setHandle('@' + (data.username ?? ''));
          setBio(data.bio ?? '');
          setAvatar(data.avatar_url ?? '');
          setAvatarUrl(data.avatar_url ?? '');
          setHeaderUrl(data.header_url ?? '');
        }
      });
  }, [user]);

  // Supabase から投稿を取得
  useEffect(() => {
    if (!user) return;
    setPostsLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('posts')
      .select('id, content, hashtags, color, is_mutual, expires_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }: { data: any[]; error: any }) => {
        if (error) { console.error('投稿取得エラー:', error); }
        if (data) {
          const mapped: Post[] = data.map((row: any) => ({
            id:        row.id,
            avatar:    avatar || CURRENT_USER.avatar,
            handle:    handle || CURRENT_USER.handle,
            name:      name   || CURRENT_USER.name,
            content:   row.content,
            hashtags:  row.hashtags ?? [],
            time:      getRelativeTime(row.created_at),
            createdAt: new Date(row.created_at).getTime(),
            expiresAt: row.expires_at
              ? new Date(row.expires_at).getTime()
              : Date.now() + 999 * 24 * 60 * 60 * 1000,
            isMutual:  row.is_mutual,
          }));
          setMyPosts(mapped);
        }
        setPostsLoading(false);
      });
  // avatar/handle/name が確定してから再実行するために依存に含める
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, avatar, handle, name]);

  // Supabase から双方向フレンドを取得
  useEffect(() => {
    if (!user) return;
    setFriendsLoading(true);
    getFriends(supabase as any, user.id)
      .then(profiles => {
        const mapped: Friend[] = profiles
          .map(p => ({
            id:       p.id,
            name:     p.display_name ?? '',
            handle:   '@' + (p.username ?? ''),
            username: p.username ?? '',
            avatar:   p.avatar_url ?? '👤',
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ja', { sensitivity: 'base' }));
        setFriends(mapped);
        setFriendsLoading(false);
      })
      .catch(err => { console.error('友達取得エラー:', err); setFriendsLoading(false); });
  }, [user]);

  async function handleSave(d: { name: string; handle: string; bio: string; avatar: string; avatarUrl: string; headerUrl: string }) {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('profiles').update({
      display_name: d.name,
      username:     d.handle.replace('@', ''),
      bio:          d.bio,
      avatar_url:   d.avatarUrl || d.avatar,
      header_url:   d.headerUrl,
    }).eq('id', user.id);

    if (!error) {
      setName(d.name);
      setHandle(d.handle);
      setBio(d.bio);
      setAvatar(d.avatarUrl || d.avatar);
      setAvatarUrl(d.avatarUrl);
      setHeaderUrl(d.headerUrl);
      setEditing(false);
      await refreshProfile();
    } else {
      console.error('プロフィール更新エラー:', error);
      alert('保存に失敗しました。もう一度お試しください。');
    }
  }

  function handleTogglePin(id: string) {
    if (pinnedIds.includes(id)) {
      setPinnedIds(prev => prev.filter(x => x !== id));
    } else if (pinnedIds.length >= 3) {
      setPinToast(t('pinMax'));
      setTimeout(() => setPinToast(''), 2500);
    } else {
      setPinnedIds(prev => [...prev, id]);
    }
  }

  const pinnedPosts   = myPosts.filter(p => pinnedIds.includes(p.id));
  const unpinnedPosts = myPosts.filter(p => !pinnedIds.includes(p.id));

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto" style={{ background: 'var(--background)' }}>

      {/* ── カバー画像 ───────────────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        <div
          className="h-36 w-full"
          style={{
            background: 'linear-gradient(135deg, #1a0533 0%, #2D1A5C 40%, #0D2A5B 100%)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 65% 40%, rgba(255,26,26,0.12) 0%, transparent 65%)',
            }}
          />
        </div>

        {/* ナビ（左上に戻るボタン） */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center px-3"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 12px), 12px)', paddingBottom: 8 }}
        >
          <button
            onClick={() => router.push('/home')}
            className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
        </div>

        {/* アバター（カバー下端から -36px） */}
        <div className="absolute left-4" style={{ bottom: '-36px' }}>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{
              background: 'var(--surface-2)',
              border: '3px solid var(--background)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}
          >
            {avatar}
          </div>
        </div>
      </div>

      {/* ── プロフィール情報 ─────────────────────────────────────── */}
      <div
        className="px-4 pt-14 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--surface-2)' }}
      >
        {/* ボタン行：友達 ＋ 編集（右寄せ） */}
        <div className="flex items-center justify-end gap-2 mb-3">
          <button
            onClick={() => setShowFriends(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold active:scale-[0.97] transition-transform"
            style={{
              background: 'transparent',
              border: '1px solid var(--surface-2)',
              color: 'var(--foreground)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" style={{ color: 'var(--muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            {t('friends')}（{friendsLoading ? '…' : friends.length}）
          </button>
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-1.5 rounded-full text-sm font-bold active:scale-[0.97] transition-transform"
            style={{
              background: 'transparent',
              border: '1px solid var(--surface-2)',
              color: 'var(--foreground)',
            }}
          >
            {t('editProfile')}
          </button>
        </div>

        <h1 className="text-base font-black leading-tight" style={{ color: 'var(--foreground)' }}>
          {name}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          {handle}
        </p>

        {bio && (
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {bio}
          </p>
        )}

        {/* フォロー中ハッシュタグ */}
        <div className="mb-5">
          <button
            onClick={() => setShowTagManager(true)}
            className="flex items-center gap-1.5 text-xs font-semibold mb-2 active:opacity-70 transition-opacity"
            style={{ color: '#E63946', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <span>🏷</span>
            <span>{t('followingHashtags')}</span>
            <span
              className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
              style={{ background: '#E63946' }}
            >
              {followedHashtags.length}
            </span>
          </button>
        </div>

        {/* HEAT MAP */}
        <PassionGraph items={MY_PASSION} />
      </div>

      {/* ── タブバー ─────────────────────────────────────────────── */}
      <div
        className="flex items-center flex-shrink-0 sticky top-0 z-30"
        style={{
          background: 'var(--background)',
          borderBottom: '1px solid var(--surface-2)',
        }}
      >
        {/* 投稿タブ */}
        <button
          onClick={() => setActiveTab('posts')}
          aria-label={t('posts')}
          className="flex-1 py-3 flex items-center justify-center transition-all active:opacity-70 relative"
          style={{ color: activeTab === 'posts' ? '#7C6FE8' : 'var(--muted)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
          {activeTab === 'posts' && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: RAINBOW }} />
          )}
        </button>

        {/* メモリータブ */}
        <button
          onClick={() => setActiveTab('memory')}
          aria-label={t('memory')}
          className="flex-1 py-3 flex items-center justify-center transition-all active:opacity-70 relative"
          style={{ color: activeTab === 'memory' ? '#7C6FE8' : 'var(--muted)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {activeTab === 'memory' && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: RAINBOW }} />
          )}
        </button>
      </div>

      {/* ── 投稿タブ ─────────────────────────────────────────────── */}
      {activeTab === 'posts' && (
        postsLoading ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>
          </div>
        ) : (
        <div className="flex flex-col pb-10">
          {/* ピン済み */}
          <div className="px-4 pt-4 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: '#FF1A1A' }}>
              <span>📌</span> Pinned ({pinnedPosts.length}/3)
            </p>
            {pinnedPosts.length === 0 ? (
              <p className="text-sm py-2" style={{ color: 'var(--muted)' }}>{t('noPins')}</p>
            ) : (
              <div style={{ borderTop: '1px solid var(--surface-2)' }}>
                {pinnedPosts.map(post => (
                  <ProfilePostRow key={post.id} post={post} isPinned onTogglePin={handleTogglePin} hashtagBorderColor={hashtagColor || undefined} />
                ))}
              </div>
            )}
          </div>

          {/* 全投稿 */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>All Posts</p>
          </div>
          {unpinnedPosts.length === 0 ? (
            <EmptyMsg />
          ) : (
            <div style={{ borderTop: '1px solid var(--surface-2)' }}>
              {unpinnedPosts.map(post => (
                <ProfilePostRow key={post.id} post={post} isPinned={false} onTogglePin={handleTogglePin} hashtagBorderColor={hashtagColor || undefined} />
              ))}
            </div>
          )}
        </div>
        )
      )}

      {/* ── メモリーカレンダータブ ────────────────────────────────── */}
      {activeTab === 'memory' && <MemoryCalendarTab />}

      {/* ── ピン制限トースト ─────────────────────────────────────── */}
      {pinToast && (
        <div
          style={{
            position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(30,20,60,0.95)', border: '1px solid rgba(255,26,26,0.5)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            padding: '10px 20px', borderRadius: 24, zIndex: 300,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          {pinToast}
        </div>
      )}

      {/* ── 編集モーダル ─────────────────────────────────────────── */}
      {editing && (
        <EditModal
          name={name} handle={handle} bio={bio} avatar={avatar}
          avatarUrl={avatarUrl} headerUrl={headerUrl} user={user}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}

      {/* ── 友達ボトムシート ──────────────────────────────────────── */}
      {showFriends && (
        <FriendsSheet
          onClose={() => setShowFriends(false)}
          friends={friends}
          loading={friendsLoading}
        />
      )}

      {/* ── ハッシュタグ管理モーダル ──────────────────────────────── */}
      {showTagManager && (
        <HashtagManagerModal
          onClose={() => setShowTagManager(false)}
        />
      )}
    </div>
  );
}

// ── 投稿行 ────────────────────────────────────────────────────────

function ProfilePostRow({ post, isPinned, onTogglePin, hashtagBorderColor }: {
  post: Post;
  isPinned?: boolean;
  onTogglePin?: (id: string) => void;
  hashtagBorderColor?: string;
}) {
  const t = useTranslations('profile');
  const router = useRouter();
  const hashtagColor = typeof window !== 'undefined' ? localStorage.getItem('sync_hashtag_color') || '' : '';
  return (
    <div
      className="flex gap-3 px-4 py-4 active:opacity-80 transition-opacity cursor-pointer"
      style={{ borderBottom: '1px solid var(--surface-2)' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 mt-0.5"
        style={{ background: 'var(--surface-2)' }}
      >
        {post.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
          <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
            {post.name}
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {post.handle}
          </span>
          <span className="text-xs ml-auto" style={{ color: 'rgba(136,136,170,0.5)' }}>
            {post.time}
          </span>
          {onTogglePin && (
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin(post.id); }}
              className="w-7 h-7 flex items-center justify-center rounded-full active:scale-90 transition-all"
              style={{
                background: isPinned ? 'rgba(255,26,26,0.18)' : 'transparent',
                fontSize: 13,
                opacity: isPinned ? 1 : 0.35,
              }}
              title={isPinned ? t('pinRemove') : t('pinAdd')}
            >
              📌
            </button>
          )}
        </div>
        <p
          className="text-sm leading-relaxed whitespace-pre-line mb-2"
          style={{ color: 'rgba(255,255,255,0.82)' }}
        >
          {post.content.replace(/#\S+/g, '').trim()}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {post.hashtags.map((tag) => (
            <button
              key={tag}
              onClick={(e) => { e.stopPropagation(); router.push(`/search?tag=${encodeURIComponent(tag.replace(/^#/, ''))}`); }}
              style={hashtagColor ? {
                background: 'transparent',
                border: `1.5px solid ${hashtagColor}`,
                color: '#ffffff',
                padding: '2px 10px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-block',
                cursor: 'pointer',
              } : {
                background: 'linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(90deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF,#9B59B6) border-box',
                border: '1.5px solid transparent',
                color: '#ffffff',
                padding: '2px 10px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-block',
                cursor: 'pointer',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyMsg({ children }: { children?: React.ReactNode }) {
  const t = useTranslations('profile');
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {children ?? t('noPosts')}
      </p>
    </div>
  );
}

// ── MemoryCalendarTab ─────────────────────────────────────────────

function MemoryCalendarTab() {
  const router = useRouter();
  const today = new Date();
  const [year,        setYear]       = useState(today.getFullYear());
  const [month,       setMonth]      = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedData: MemoryDayData | null = selectedDay ? (MEMORY_DATA[selectedDay] ?? null) : null;

  return (
    <div className="flex flex-col pb-10">
      {/* ナビゲーション */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-all" style={{ background: 'var(--surface-2)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4" style={{ color: 'var(--foreground)' }}>
            <path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <p className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>{year}年{month + 1}月</p>
        <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-all" style={{ background: 'var(--surface-2)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4" style={{ color: 'var(--foreground)' }}>
            <path strokeLinecap="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {DOW_LABELS.map((d, i) => (
          <p key={d} className="text-center text-[11px] font-bold py-1"
            style={{ color: i === 0 ? '#E63946' : i === 6 ? '#4A9EFF' : 'rgba(255,255,255,0.35)' }}>
            {d}
          </p>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 px-3 gap-y-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;
          const key  = dateKey(day);
          const data = MEMORY_DATA[key];
          const hasPosts       = data && data.posts.length > 0;
          const hasConnections = data && data.newConnections.length > 0;
          const hasPhotos      = data && data.savedPhotos.length > 0;
          const isSelected     = selectedDay === key;
          const isToday        = key === todayKey;
          const dow = (firstDow + day - 1) % 7;
          return (
            <button
              key={key}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              className="flex flex-col items-center py-1.5 rounded-xl transition-all active:scale-90"
              style={{
                background: isSelected ? 'rgba(255,26,26,0.15)' : 'transparent',
                border: isSelected ? '1.5px solid rgba(255,26,26,0.45)' : '1.5px solid transparent',
              }}
            >
              <span className="text-[13px] leading-tight"
                style={{
                  fontWeight: isToday ? 800 : 500,
                  color: isToday ? '#FF1A1A' : dow === 0 ? '#E63946' : dow === 6 ? '#4A9EFF' : 'rgba(255,255,255,0.82)',
                }}>
                {day}
              </span>
              <div className="flex gap-[2px] mt-0.5 h-[9px] items-center">
                {hasPosts       && <span style={{ fontSize: 6, color: '#FF1A1A', lineHeight: 1 }}>●</span>}
                {hasConnections && <span style={{ fontSize: 6, color: '#E63946', lineHeight: 1 }}>♡</span>}
                {hasPhotos      && <span style={{ fontSize: 6, color: '#4A9EFF', lineHeight: 1 }}>■</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* アコーディオン詳細 */}
      {selectedDay && (
        <div className="mx-4 mt-4 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
          <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--surface-2)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{selectedDay}</p>
          </div>

          {!selectedData || (
            selectedData.posts.length === 0 &&
            selectedData.savedPhotos.length === 0 &&
            selectedData.newConnections.length === 0 &&
            selectedData.events.length === 0
          ) ? (
            <p className="text-sm px-4 py-4" style={{ color: 'var(--muted)' }}>この日の記録はありません</p>
          ) : (
            <div>
              {selectedData.posts.length > 0 && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--surface-2)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: '#FF1A1A' }}>
                    <span>📝</span> 投稿
                  </p>
                  {selectedData.posts.map(p => (
                    <div key={p.id} className="py-1">
                      {/* 投稿テキスト */}
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
                        {p.text}
                      </p>
                      {/* リアクター一覧 */}
                      {p.reactions && p.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {p.reactions.map((r: Reaction) => (
                            <button
                              key={r.id}
                              onClick={() => router.push(`/profile/${r.userId}`)}
                              style={{
                                display:      'flex',
                                alignItems:   'center',
                                gap:          4,
                                background:   'rgba(255,255,255,0.08)',
                                border:       '0.5px solid rgba(255,255,255,0.15)',
                                borderRadius: 20,
                                padding:      '4px 8px',
                                cursor:       'pointer',
                              }}
                            >
                              {/* 絵文字アイコン（丸背景） */}
                              <span style={{
                                width:          18,
                                height:         18,
                                borderRadius:   '50%',
                                background:     'linear-gradient(135deg,#FF1A1A,#8B0000)',
                                display:        'flex',
                                alignItems:     'center',
                                justifyContent: 'center',
                                fontSize:       11,
                                lineHeight:     1,
                                flexShrink:     0,
                              }}>
                                {r.avatar}
                              </span>
                              {/* リアクション絵文字 */}
                              <span style={{ fontSize: 13, lineHeight: 1 }}>{r.emoji}</span>
                              {/* ユーザー名 */}
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{r.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {selectedData.savedPhotos.length > 0 && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--surface-2)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: '#4A9EFF' }}>
                    <span>📷</span> 保存した写真 ({selectedData.savedPhotos.length})
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedData.savedPhotos.map(s => (
                      <div key={s.id} className="w-14 h-14 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--surface-2)' }}>🖼️</div>
                    ))}
                  </div>
                </div>
              )}
              {selectedData.newConnections.length > 0 && (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--surface-2)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: '#E63946' }}>
                    <span>🤝</span> 新しいつながり
                  </p>
                  <div className="flex flex-col gap-1">
                    {selectedData.newConnections.map(c => (
                      <button
                        key={c.id}
                        onClick={() => router.push(`/profile/${c.username.replace('@', '')}`)}
                        className="flex items-center gap-2 w-full rounded-xl px-2 py-1.5 active:opacity-70 transition-opacity text-left"
                        style={{ background: 'transparent' }}
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: 'var(--surface-2)' }}>{c.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{c.username}</p>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--muted)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedData.events.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <span>🎉</span> イベント
                  </p>
                  <div className="flex flex-col gap-1">
                    {selectedData.events.map(e => (
                      <button
                        key={e.id}
                        onClick={() => router.push(`/search/${e.eventId}`)}
                        className="flex items-center gap-2 w-full rounded-xl px-2 py-1.5 active:opacity-70 transition-opacity text-left"
                        style={{ background: 'transparent' }}
                      >
                        <p className="flex-1 text-sm" style={{ color: 'rgba(255,255,255,0.82)' }}>{e.name}</p>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--muted)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 凡例 */}
      <div className="flex gap-5 justify-center mt-4 px-4">
        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}><span style={{ color: '#FF1A1A' }}>●</span> 投稿</span>
        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}><span style={{ color: '#E63946' }}>♡</span> つながり</span>
        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}><span style={{ color: '#4A9EFF' }}>■</span> 保存</span>
      </div>
    </div>
  );
}
