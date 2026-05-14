import { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import type { PointWallet, TaskInstance } from '../../../types/models';
import { useAuth } from '../../../hooks/useAuth';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import { Display, Body, Label, Muted, Data } from '../../../design/Text';

type Badge = {
  id: string;
  emoji: string;
  zh: string;
  got: boolean;
};

export default function ChildMe() {
  const { user } = useAuth();
  const router = useRouter();
  const uid = user?.id;
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<PointWallet | null>(null);
  const [instances, setInstances] = useState<TaskInstance[]>([]);

  useEffect(() => {
    if (!uid) return;
    const unsub = firestore()
      .collection('familyMemberships')
      .where('userId', '==', uid)
      .where('status', '==', 'active')
      .limit(1)
      .onSnapshot((snap) => {
        if (!snap) return;
        if (!snap.empty) setFamilyId(snap.docs[0].data().familyId);
      }, (err) => console.error('[Me] membership error:', (err as any)?.code));
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid || !familyId) return;
    const unsub = firestore()
      .collection('pointWallets')
      .where('userId', '==', uid)
      .where('familyId', '==', familyId)
      .limit(1)
      .onSnapshot((snap) => {
        if (!snap) return;
        if (!snap.empty) {
          setWallet({ id: snap.docs[0].id, ...snap.docs[0].data() } as PointWallet);
        }
      }, (err) => console.error('[Me] wallet error:', (err as any)?.code));
    return unsub;
  }, [uid, familyId]);

  useEffect(() => {
    if (!uid || !familyId) return;
    const unsub = firestore()
      .collection('taskInstances')
      .where('userId', '==', uid)
      .where('familyId', '==', familyId)
      .onSnapshot((snap) => {
        if (!snap) return;
        setInstances(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskInstance)));
      }, (err) => console.error('[Me] instances error:', (err as any)?.code));
    return unsub;
  }, [uid, familyId]);

  const stars = wallet?.balance || 0;
  const streak = 0;

  const age = useMemo(() => {
    if (!user?.birthday) return null;
    const bd: Date =
      typeof (user.birthday as any)?.toDate === 'function'
        ? (user.birthday as any).toDate()
        : new Date(user.birthday as any);
    return Math.floor((Date.now() - bd.getTime()) / (365.25 * 86400 * 1000));
  }, [user]);

  const firstChar = (user?.displayName || '你').charAt(0);

  const badges: Badge[] = [
    { id: 'b1', emoji: '🔥', zh: '連續 7 天', got: streak >= 7 },
    { id: 'b2', emoji: '📚', zh: '讀書家', got: true },
    { id: 'b3', emoji: '🎨', zh: '創作家', got: false },
    { id: 'b4', emoji: '⭐', zh: '100 顆星', got: stars >= 100 },
    { id: 'b5', emoji: '🌙', zh: '夜貓子', got: false },
    { id: 'b6', emoji: '🏆', zh: '月冠軍', got: true },
  ];

  const badgeCount = badges.filter((b) => b.got).length;

  const weekData = useMemo(() => {
    const now = new Date();
    const dayLabels = ['一', '二', '三', '四', '五', '六', '日'];
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);

    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(monday);
      dayStart.setDate(monday.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const isFuture = dayStart > todayMidnight;

      const count = instances.filter((inst) => {
        if (inst.status !== 'approved' || !inst.reviewedAt) return false;
        const rv: any = inst.reviewedAt;
        const d: Date = typeof rv?.toDate === 'function' ? rv.toDate() : new Date(rv);
        return d >= dayStart && d <= dayEnd;
      }).length;

      return { label: dayLabels[i], count, isFuture };
    });
  }, [instances]);

  const handleSignOut = () => {
    Alert.alert('登出', '確定要登出嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '確定', style: 'destructive', onPress: async () => {
          try { await auth().signOut(); } catch {}
          router.replace('/auth/sign-in');
        } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Starfield count={30} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Display style={{ color: P.bg, fontSize: 40 }}>{firstChar}</Display>
          </View>
          <Display style={{ fontSize: 24, marginTop: spacing.md }}>
            {user?.displayName || '小朋友'}
          </Display>
          {age != null && (
            <Muted style={{ fontSize: 12, marginTop: 2 }}>{age} 歲</Muted>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Data style={{ color: P.primary, fontSize: 22, fontWeight: '700' }}>{stars}</Data>
            <Label color={P.muted} style={styles.statLabel}>總星光</Label>
          </View>
          <View style={styles.statCard}>
            <Data style={{ color: P.accent, fontSize: 22, fontWeight: '700' }}>🔥 {streak}</Data>
            <Label color={P.muted} style={styles.statLabel}>連續天數</Label>
          </View>
          <View style={styles.statCard}>
            <Data style={{ color: P.green, fontSize: 22, fontWeight: '700' }}>{badgeCount}</Data>
            <Label color={P.muted} style={styles.statLabel}>徽章</Label>
          </View>
        </View>

        {/* Weekly bar chart */}
        <View style={styles.section}>
          <View style={styles.weekCard}>
            <Label style={styles.weekTitle}>本週進度</Label>
            <View style={styles.weekBars}>
              {weekData.map((d, i) => (
                <View key={i} style={styles.weekBarCol}>
                  <View style={styles.weekBarTrack}>
                    <View
                      style={[
                        styles.weekBar,
                        {
                          height: d.isFuture ? 8 : Math.max(8, Math.min(d.count * 8, 40)),
                          backgroundColor: d.isFuture ? P.surfaceHi : P.primary,
                        },
                      ]}
                    />
                  </View>
                  <Label style={styles.weekDayLabel}>{d.label}</Label>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <Label color={P.muted} style={{ marginBottom: spacing.sm }}>徽章</Label>
          <View style={styles.badgeGrid}>
            {badges.map((b) => (
              <View
                key={b.id}
                style={[
                  styles.badgeCard,
                  b.got
                    ? { backgroundColor: P.surface, borderColor: `${P.primary}66`, borderStyle: 'solid' }
                    : { backgroundColor: 'transparent', borderColor: P.border, borderStyle: 'dashed', opacity: 0.5 },
                ]}
              >
                <Body style={{ fontSize: 28 }}>{b.emoji}</Body>
                <Label style={{ marginTop: 6, color: b.got ? P.text : P.muted, fontSize: 11 }}>
                  {b.zh}
                </Label>
              </View>
            ))}
          </View>
        </View>

        {/* Settings list */}
        <View style={styles.section}>
          <View style={styles.settingsList}>
            <View style={styles.settingsRow}>
              <Label style={styles.settingsLabel}>語言</Label>
              <Muted style={styles.settingsValue}>中文 / English</Muted>
            </View>
            <View style={styles.settingsDivider} />
            <View style={styles.settingsRow}>
              <Label style={styles.settingsLabel}>家長協助</Label>
              <Muted style={styles.settingsValue}>→</Muted>
            </View>
            <View style={styles.settingsDivider} />
            <Pressable onPress={handleSignOut} style={styles.settingsRow}>
              <Label style={[styles.settingsLabel, { color: P.accentHot }]}>登出</Label>
              <Muted style={styles.settingsValue}>→</Muted>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  scroll: { paddingBottom: spacing['3xl'] + spacing.lg },
  avatarWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    borderWidth: 3,
    borderColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: P.primary,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  statsRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 14,
    backgroundColor: P.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 1,
  },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  weekCard: {
    backgroundColor: P.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: P.border,
  },
  weekTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: P.muted,
    marginBottom: 12,
  },
  weekBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  weekBarCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekBarTrack: {
    height: 40,
    justifyContent: 'flex-end',
    width: '70%',
  },
  weekBar: {
    width: '100%',
    borderRadius: 4,
  },
  weekDayLabel: {
    fontSize: 10,
    color: P.muted,
    marginTop: 4,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeCard: {
    width: '31%',
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  settingsList: {
    backgroundColor: P.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: P.border,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  settingsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: P.text,
  },
  settingsValue: {
    fontSize: 13,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: P.border,
  },
});
