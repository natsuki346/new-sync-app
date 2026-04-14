'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

interface AuthContextType {
  user:           User | null;
  session:        Session | null;
  profile:        Profile | null;
  loading:        boolean;
  /** profiles テーブルに行が存在するか */
  hasProfile:     boolean;
  /** profiles チェック中は true */
  profileLoading: boolean;
  followedHashtags:  string[];
  sendOtp:       (phone: string) => Promise<{ error: unknown }>;
  verifyOtp:     (phone: string, token: string) => Promise<{ error: unknown }>;
  signOut:       () => Promise<void>;
  refreshProfile: () => Promise<void>;
  followHashtag:   (tag: string) => Promise<void>;
  unfollowHashtag: (tag: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,           setUser]           = useState<User | null>(null);
  const [session,        setSession]        = useState<Session | null>(null);
  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [hasProfile,       setHasProfile]       = useState(false);
  const [profileLoading,   setProfileLoading]   = useState(true);
  const [followedHashtags, setFollowedHashtags] = useState<string[]>([]);

  // セッション初期化 + 変更監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // user が確定したら profiles テーブルを取得
  useEffect(() => {
    if (loading) return;

    if (!user) {
      setProfile(null);
      setHasProfile(false);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setHasProfile(data !== null);
        setProfileLoading(false);
      });

    // GPS取得 → profiles の lat/lng を更新（ログイン後に一度だけ）
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await (supabase as any)
            .from('profiles')
            .update({ lat: pos.coords.latitude, lng: pos.coords.longitude })
            .eq('id', user.id);
        },
        (err) => console.warn('GPS取得失敗:', err),
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, [user, loading]);

  useEffect(() => {
    if (user) console.log('Current user ID:', user.id);
  }, [user]);

  // フォロー中ハッシュタグを取得
  useEffect(() => {
    if (!user) {
      setFollowedHashtags([]);
      return;
    }
    (supabase as any)
      .from('follows')
      .select('tag')
      .eq('follower_id', user.id)
      .eq('type', 'hashtag')
      .then(({ data }: { data: Array<{ tag: string }> | null }) => {
        const tags = (data ?? []).map(f => f.tag).filter(Boolean) as string[];
        setFollowedHashtags(tags);
      });
  }, [user]);

  const sendOtp = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error };
  };

  const verifyOtp = async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();
      setHasProfile(profile !== null);
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setHasProfile(false);
    setFollowedHashtags([]);
  };

  const followHashtag = async (tag: string) => {
    if (!user) return;

    // ── follows テーブル：既存行を確認してから INSERT（onConflict 不要）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('follows') as any)
      .select('id')
      .eq('follower_id', user.id)
      .eq('type', 'hashtag')
      .eq('tag', tag)
      .maybeSingle();

    if (!existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: followsError } = await (supabase.from('follows') as any).insert({
        follower_id:  user.id,
        following_id: user.id,   // follows.following_id は NOT NULL のため必須。
                                  // hashtag フォロー時は意味を持たないが、
                                  // follower_id と同値を入れることでスキーマ制約を満たす。
        type:         'hashtag',
        status:       'accepted',
        tag,
      });
      if (followsError) {
        console.error('follows insert error:', JSON.stringify(followsError, null, 2));
        console.error('follows insert payload:', { follower_id: user.id, following_id: user.id, type: 'hashtag', status: 'accepted', tag });
      }
    }

    // ── hashtag_engagements：重複無視で upsert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: engError } = await (supabase.from('hashtag_engagements') as any).upsert({
      user_id:        user.id,
      tag,
      post_count:     0,
      reaction_count: 0,
    }, { onConflict: 'user_id,tag', ignoreDuplicates: true });
    if (engError) console.error('hashtag_engagements upsert error:', engError);

    setFollowedHashtags(prev => [...new Set([...prev, tag])]);
  };

  const unfollowHashtag = async (tag: string) => {
    if (!user) return;
    await supabase.from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('type', 'hashtag')
      .eq('tag', tag);
    setFollowedHashtags(prev => prev.filter(t => t !== tag));
  };

  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    setProfile(data);
    setHasProfile(data !== null);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      hasProfile, profileLoading,
      followedHashtags,
      sendOtp, verifyOtp, signOut, refreshProfile,
      followHashtag, unfollowHashtag,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
