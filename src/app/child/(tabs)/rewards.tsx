import { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import type { RewardItem, RewardOrder, PointWallet } from '../../../types/models';
import { useAuth } from '../../../hooks/useAuth';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import { Empty } from '../../../design/Empty';
import { Display, H3, BodySm, Label, Muted, Data } from '../../../design/Text';

const { width } = Dimensions.get('window');
const HORIZONTAL_PAD = 22;
const CARD_GAP = 10;
const CARD_WIDTH = (width - HORIZONTAL_PAD * 2 - CARD_GAP) / 2;

const rewardEmoji = (title: string): string => {
  const t = title || '';
  if (/遊戲|電玩/.test(t)) return '🎮';
  if (/書|讀/.test(t)) return '📖';
  if (/玩具/.test(t)) return '🧸';
  if (/冰淇淋|甜/.test(t)) return '🍦';
  if (/電影/.test(t)) return '🎬';
  if (/零用|錢/.test(t)) return '💰';
  if (/LEGO|積木/.test(t)) return '🧱';
  return '🎁';
};

const fmtTime = (ts: any): string => {
  if (!ts) return '';
  const d: Date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return d.toLocaleDateString();
};

export default function ChildRewards() {
  const { user } = useAuth();
  const uid = user?.id;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'shop' | 'history'>('shop');
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [wallet, setWallet] = useState<PointWallet | null>(null);
  const [orders, setOrders] = useState<RewardOrder[]>([]);

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
      }, (err) => console.error('[ChildRewards] membership error:', (err as any)?.code));
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
      }, (err) => console.error('[ChildRewards] wallet error:', (err as any)?.code));
    return unsub;
  }, [uid, familyId]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('rewardItems')
      .where('familyId', '==', familyId)
      .where('status', '==', 'active')
      .onSnapshot((snap) => {
        if (!snap) return;
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RewardItem)));
      }, (err) => console.error('[ChildRewards] items error:', (err as any)?.code));
    return unsub;
  }, [familyId]);

  useEffect(() => {
    if (!uid || !familyId) return;
    const unsub = firestore()
      .collection('rewardOrders')
      .where('userId', '==', uid)
      .where('familyId', '==', familyId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot((snap) => {
        if (!snap) return;
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RewardOrder)));
      }, (err) => console.error('[ChildRewards] orders error:', (err as any)?.code));
    return unsub;
  }, [uid, familyId]);

  const balance = wallet?.balance || 0;

  const { activeOrder, history } = useMemo(() => {
    const active = orders.find((o) =>
      ['pending', 'approved', 'delivered'].includes(o.status)
    );
    const hist = orders.filter((o) =>
      ['completed', 'cancelled', 'rejected'].includes(o.status)
    );
    return { activeOrder: active, history: hist };
  }, [orders]);

  const activeItem = activeOrder
    ? items.find((i) => i.id === activeOrder.itemId)
    : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Starfield count={18} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Label color={P.muted} style={{ letterSpacing: 1.5 }}>獎勵</Label>
          <Display style={{ marginTop: 4 }}>
            你有 <Text style={{ color: P.primary }}>★ {balance}</Text>
          </Display>

          {/* Segmented control */}
          <View style={styles.segmented}>
            <Pressable
              onPress={() => setActiveTab('shop')}
              style={[styles.segTab, activeTab === 'shop' && styles.segTabActive]}
            >
              <Label
                style={[
                  styles.segLabel,
                  activeTab === 'shop' && styles.segLabelActive,
                ]}
              >
                可兌換
              </Label>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('history')}
              style={[styles.segTab, activeTab === 'history' && styles.segTabActive]}
            >
              <Label
                style={[
                  styles.segLabel,
                  activeTab === 'history' && styles.segLabelActive,
                ]}
              >
                我換過的
              </Label>
            </Pressable>
          </View>
        </View>

        {/* Active order banner */}
        {activeOrder && activeItem && (
          <Pressable
            onPress={() => router.push(`/child/order/${activeOrder.id}` as any)}
            style={[
              styles.activeBanner,
              {
                backgroundColor:
                  activeOrder.status === 'approved' || activeOrder.status === 'delivered'
                    ? `${P.green}22`
                    : `${P.accent}22`,
                borderColor:
                  activeOrder.status === 'approved' || activeOrder.status === 'delivered'
                    ? `${P.green}55`
                    : `${P.accent}55`,
              },
            ]}
          >
            <BodySm style={{ fontSize: 24 }}>{rewardEmoji(activeItem.title)}</BodySm>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Label
                style={{
                  color:
                    activeOrder.status === 'approved' || activeOrder.status === 'delivered'
                      ? P.green
                      : P.accent,
                  fontSize: 11,
                }}
              >
                {activeOrder.status === 'pending' && '⏳ 等爸媽確認'}
                {activeOrder.status === 'approved' && '✓ 準備好了！'}
                {activeOrder.status === 'delivered' && '🎁 已送出'}
              </Label>
              <H3 style={{ marginTop: 2, fontSize: 14 }}>{activeItem.title}</H3>
            </View>
            <Data style={{ color: P.muted, fontSize: 18 }}>›</Data>
          </Pressable>
        )}

        {/* Shop tab */}
        {activeTab === 'shop' && (
          <View style={styles.section}>
            {items.length === 0 ? (
              <Empty emoji="🎁" title="還沒有獎勵" body="請爸媽先新增一些禮物吧！" />
            ) : (
              <View style={styles.grid}>
                {items.map((r) => {
                  const can = balance >= r.pointCost && !activeOrder;
                  const short = Math.max(0, r.pointCost - balance);
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() =>
                        can && router.push(`/child/reward/${r.id}` as any)
                      }
                      disabled={!can}
                      style={({ pressed }) => [
                        styles.rewardCard,
                        !can && { opacity: 0.5 },
                        pressed && can && { opacity: 0.85 },
                      ]}
                    >
                      <View style={styles.rewardEmojiBox}>
                        <BodySm style={{ fontSize: 26 }}>{rewardEmoji(r.title)}</BodySm>
                      </View>
                      <H3
                        numberOfLines={2}
                        style={{ marginTop: 10, fontSize: 13, lineHeight: 18 }}
                      >
                        {r.title}
                      </H3>
                      <View style={styles.rewardFooter}>
                        <Data
                          style={{
                            color: can ? P.primary : P.muted,
                            fontSize: 15,
                            fontWeight: '700',
                          }}
                        >
                          ★ {r.pointCost}
                        </Data>
                      </View>
                      {!can && short > 0 && (
                        <Muted style={{ fontSize: 10, marginTop: 2 }}>
                          還差 {short}
                        </Muted>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <View style={styles.section}>
            {history.length === 0 ? (
              <Empty emoji="✦" title="還沒換過" body="快去逛逛可以換什麼！" />
            ) : (
              <>
                {history.map((o) => {
                  const r = items.find((it) => it.id === o.itemId);
                  const statusColor =
                    o.status === 'completed'
                      ? P.green
                      : o.status === 'cancelled'
                      ? P.muted
                      : P.accentHot;
                  const statusText =
                    o.status === 'completed'
                      ? '已拿到'
                      : o.status === 'cancelled'
                      ? '取消了'
                      : '沒答應';
                  return (
                    <View key={o.id} style={styles.historyRow}>
                      <View style={styles.historyEmoji}>
                        <BodySm style={{ fontSize: 20 }}>
                          {rewardEmoji(r?.title || '')}
                        </BodySm>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <H3 numberOfLines={1} style={{ fontSize: 14 }}>
                          {r?.title || '—'}
                        </H3>
                        <BodySm style={{ color: statusColor, marginTop: 2, fontSize: 11 }}>
                          {fmtTime(o.createdAt)} · {statusText}
                        </BodySm>
                      </View>
                      <Data style={{ color: P.muted, fontSize: 13, fontWeight: '700' }}>
                        −★ {o.pointCostSnapshot}
                      </Data>
                    </View>
                  );
                })}
                <Muted style={styles.historyTotal}>
                  共 {history.length} 筆記錄
                </Muted>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  scroll: { paddingBottom: spacing['3xl'] + spacing.lg },
  header: { paddingHorizontal: HORIZONTAL_PAD, paddingTop: spacing.md },
  segmented: {
    marginTop: spacing.md,
    flexDirection: 'row',
    backgroundColor: P.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.border,
    padding: 4,
  },
  segTab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  segTabActive: {
    backgroundColor: P.primary,
  },
  segLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: P.muted,
  },
  segLabelActive: {
    color: P.bg,
  },
  activeBanner: {
    marginTop: spacing.md,
    marginHorizontal: HORIZONTAL_PAD,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: HORIZONTAL_PAD,
    paddingTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  rewardCard: {
    width: CARD_WIDTH,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
  },
  rewardEmojiBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: `${P.primary}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardFooter: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyRow: {
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyEmoji: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF1DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyTotal: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontSize: 11,
  },
});
