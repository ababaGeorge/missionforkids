import { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import type { PointWallet, TaskInstance } from '../../../types/models';
import { useAuth } from '../../../hooks/useAuth';
import { childIdFor, walletDocId } from '../../../lib/childId';
import { joinDurationLabel } from '../../../lib/joinDuration';
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
  const [showSettings, setShowSettings] = useState(false);
  const insets = useSafeAreaInsets();

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

  const childId = childIdFor(user, uid ?? '');

  useEffect(() => {
    if (!uid || !familyId) return;
    const unsub = firestore()
      .collection('pointWallets')
      .doc(walletDocId(familyId, childId))
      .onSnapshot((doc) => {
        if (!doc) return;
        setWallet(doc.exists() ? ({ id: doc.id, ...doc.data() } as PointWallet) : null);
      }, (err) => console.error('[Me] wallet error:', (err as any)?.code));
    return unsub;
  }, [uid, familyId, childId]);

  useEffect(() => {
    if (!uid || !familyId) return;
    // R2-21(P4)：刻意不加 limit——本頁統計（總完成數/連續天數/徽章門檻）需要完整歷史，
    // 查詢沒有 orderBy，limit 會按 doc ID 任意截斷、悄悄算錯統計；補 orderBy 又需要
    // 新 composite index。單一小孩的 instances 量有限，維持全量訂閱並在此註記。
    const unsub = firestore()
      .collection('taskInstances')
      .where('childId', '==', childId)
      .where('familyId', '==', familyId)
      .onSnapshot((snap) => {
        if (!snap) return;
        setInstances(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskInstance)));
      }, (err) => console.error('[Me] instances error:', (err as any)?.code));
    return unsub;
  }, [uid, familyId, childId]);

  const stars = wallet?.balance || 0;

  const toDate = (ts: any): Date =>
    typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  // 完成統計（真實資料）
  const totalApproved = useMemo(
    () => instances.filter((i) => i.status === 'approved').length,
    [instances]
  );

  // 連續天數：從今天（若今天沒有則從昨天）往回數，每天至少完成一個任務
  const streak = useMemo(() => {
    const days = new Set<string>();
    for (const inst of instances) {
      if (inst.status !== 'approved' || !inst.reviewedAt) continue;
      days.add(dayKey(toDate(inst.reviewedAt)));
    }
    if (days.size === 0) return 0;
    const cur = new Date();
    cur.setHours(0, 0, 0, 0);
    if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
    let count = 0;
    while (days.has(dayKey(cur))) {
      count += 1;
      cur.setDate(cur.getDate() - 1);
    }
    return count;
  }, [instances]);

  const age = useMemo(() => {
    if (!user?.birthday) return null;
    const bd: Date =
      typeof (user.birthday as any)?.toDate === 'function'
        ? (user.birthday as any).toDate()
        : new Date(user.birthday as any);
    return Math.floor((Date.now() - bd.getTime()) / (365.25 * 86400 * 1000));
  }, [user]);

  const joinLabel = useMemo(() => {
    if (!user?.createdAt) return null;
    const c: any = user.createdAt;
    const d: Date = typeof c?.toDate === 'function' ? c.toDate() : new Date(c);
    return joinDurationLabel(d);
  }, [user]);

  const firstChar = (user?.displayName || '你').charAt(0);

  // 徽章全部改成資料驅動的里程碑（原本 早睡達人/音樂家/讀書蟲 是寫死的假徽章）
  const badges: Badge[] = [
    { id: 'b1', emoji: '⭐', zh: '第一次完成', got: totalApproved >= 1 },
    { id: 'b2', emoji: '🌱', zh: '連 3 天', got: streak >= 3 },
    { id: 'b3', emoji: '🔥', zh: '連 7 天', got: streak >= 7 },
    { id: 'b4', emoji: '✨', zh: '100 星光', got: stars >= 100 },
    { id: 'b5', emoji: '🏅', zh: '完成 10 個', got: totalApproved >= 10 },
    { id: 'b6', emoji: '👑', zh: '完成 25 個', got: totalApproved >= 25 },
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
            <Display style={{ color: P.bg, fontSize: 40, lineHeight: 48 }}>{firstChar}</Display>
          </View>
          <Display style={{ fontSize: 24, marginTop: spacing.md }}>
            {user?.displayName || '小朋友'}
          </Display>
          {(age != null || joinLabel != null) && (
            <Muted style={{ fontSize: 12, marginTop: 2 }}>
              {age != null ? `${age} 歲` : ''}
              {age != null && joinLabel != null ? ' · ' : ''}
              {joinLabel ?? ''}
            </Muted>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Data style={{ color: P.primary, fontSize: 22, lineHeight: 28, fontWeight: '700' }}>{stars}</Data>
            <Label color={P.muted} style={styles.statLabel}>總星光</Label>
          </View>
          <View style={styles.statCard}>
            <Data style={{ color: P.accent, fontSize: 22, lineHeight: 28, fontWeight: '700' }}>🔥 {streak}</Data>
            <Label color={P.muted} style={styles.statLabel}>連續天數</Label>
          </View>
          <View style={styles.statCard}>
            <Data style={{ color: P.green, fontSize: 22, lineHeight: 28, fontWeight: '700' }}>{badgeCount}</Data>
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

        <View style={{ height: spacing.lg }} />
      </ScrollView>

      {/* Settings gear at top-right */}
      <Pressable
        onPress={() => setShowSettings(true)}
        style={[styles.gearBtn, { top: insets.top + 10 }]}
        hitSlop={10}
      >
        <Label style={{ color: P.muted, fontSize: 18, lineHeight: 22 }}>⚙</Label>
      </Pressable>

      {/* Settings modal */}
      <Modal
        visible={showSettings}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowSettings(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Label style={{ color: P.muted, fontSize: 11, letterSpacing: 1.5 }}>
                設定
              </Label>
              <Pressable onPress={() => setShowSettings(false)} hitSlop={10}>
                <Label style={{ color: P.muted, fontSize: 16 }}>✕</Label>
              </Pressable>
            </View>
            <View style={styles.settingsList}>
              <Pressable
                onPress={() => Alert.alert('語言', '尚未開放')}
                style={styles.settingsRow}
              >
                <Label style={styles.settingsLabel}>語言</Label>
                <Muted style={styles.settingsValue}>中文 / English</Muted>
              </Pressable>
              <View style={styles.settingsDivider} />
              <Pressable
                onPress={() => Alert.alert('家長協助', '尚未開放')}
                style={styles.settingsRow}
              >
                <Label style={styles.settingsLabel}>家長協助</Label>
                <Muted style={styles.settingsValue}>→</Muted>
              </Pressable>
              <View style={styles.settingsDivider} />
              <Pressable
                onPress={() => {
                  setShowSettings(false);
                  handleSignOut();
                }}
                style={styles.settingsRow}
              >
                <Label style={[styles.settingsLabel, { color: P.accentHot }]}>
                  登出
                </Label>
                <Muted style={styles.settingsValue}>→</Muted>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  signOutBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: P.border,
  },
  gearBtn: {
    position: 'absolute',
    right: 18,
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(247,242,234,0.06)',
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,23,38,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalSheet: {
    backgroundColor: P.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.border,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
