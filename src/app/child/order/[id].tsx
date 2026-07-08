import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import type { RewardItem, RewardOrder } from '../../../types/models';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import {
  Display,
  H3,
  Body,
  BodySm,
  Label,
  Muted,
  Data,
} from '../../../design/Text';

type OrderDoc = RewardOrder & { parentNote?: string | null };

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

const fmtWhen = (ts: any): string => {
  if (!ts) return '—';
  const d: Date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return d.toLocaleDateString();
};

export default function ChildOrderDetail() {
  const { id: orderId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [item, setItem] = useState<RewardItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const unsub = firestore()
      .collection('rewardOrders')
      .doc(orderId)
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const data = snap.data();
        if (!data) return;
        const ord = { id: snap.id, ...data } as OrderDoc;
        setOrder(ord);
        if (!item || item.id !== ord.itemId) {
          const itemDoc = await firestore()
            .collection('rewardItems')
            .doc(ord.itemId)
            .get();
          const iData = itemDoc.data();
          if (iData) setItem({ id: itemDoc.id, ...iData } as RewardItem);
        }
      });
    return unsub;
  }, [orderId]);

  const onClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/child/(tabs)/rewards');
  };

  const handleReceived = async () => {
    if (!order || submitting) return;
    setSubmitting(true);
    try {
      await firestore().collection('rewardOrders').doc(order.id).update({
        status: 'completed',
        completedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch {
      Alert.alert('出錯了', '再試一次。');
    } finally {
      setSubmitting(false);
    }
  };

  // B5：真·取消訂單（原本只是關閉畫面）。改 status → cancelled，
  // 觸發退款 CF 把點數退回。只能在 pending 階段取消（rules 已限制）。
  const handleCancel = () => {
    if (!order || submitting) return;
    Alert.alert('取消訂單', '確定要取消這次兌換？花掉的點數會退回給你。', [
      { text: '不取消', style: 'cancel' },
      {
        text: '取消訂單',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try {
            await firestore().collection('rewardOrders').doc(order.id).update({
              status: 'cancelled',
              cancelledAt: firestore.FieldValue.serverTimestamp(),
            });
            onClose();
          } catch {
            Alert.alert('出錯了', '再試一次。');
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  if (!order || !item) {
    return (
      <SafeAreaView style={styles.safe}>
        <Starfield count={26} />
      </SafeAreaView>
    );
  }

  const declined =
    order.status === 'cancelled' || order.status === 'rejected';

  const steps = [
    { k: 'requested', zh: '你提出', ts: order.createdAt },
    { k: 'confirmed', zh: '爸媽答應', ts: order.approvedAt },
    { k: 'delivered', zh: '你拿到了', ts: order.completedAt || order.deliveredAt },
  ];
  const orderIdx = { pending: 0, approved: 1, delivered: 2, completed: 2 } as Record<
    string,
    number
  >;
  const cur = orderIdx[order.status] ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Starfield count={26} />
      {/* Top header */}
      <View style={styles.topHeader}>
        <View style={{ width: 32 }} />
        <View style={styles.handleWrap}>
          <View style={styles.sheetHandle} />
          <Muted style={{ fontSize: 11, marginTop: 4 }}>下滑關閉 · 或點 ✕</Muted>
        </View>
        <Pressable onPress={onClose} style={styles.closeRound} hitSlop={10}>
          <Body style={{ color: P.text, fontSize: 16 }}>✕</Body>
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Label + Title */}
        <Label color={P.muted} style={{ fontSize: 11, letterSpacing: 1.5 }}>
          {declined ? '獎勵未通過' : '獎勵進行中'}
        </Label>
        <Display style={{ fontSize: 30, marginTop: 4 }}>{item.title}</Display>
        {/* Reward card horizontal */}
        <View style={styles.rewardRow}>
          <View style={styles.rewardEmojiBox}>
            <Body style={{ fontSize: 36 }}>
              {item.emoji || rewardEmoji(item.title)}
            </Body>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Muted style={{ fontSize: 11, letterSpacing: 1 }}>
              #{order.id.slice(-4).toUpperCase()}
            </Muted>
            <Data style={{ color: P.primary, fontSize: 22, marginTop: 4, fontWeight: '800' }}>
              − ★ {order.pointCostSnapshot || item.pointCost}
            </Data>
          </View>
        </View>

        {/* Timeline 4 steps */}
        {!declined && (
          <View style={styles.steps4}>
            {[
              { zh: '已下單', ts: order.createdAt },
              { zh: '爸媽確認', ts: order.approvedAt },
              { zh: '已交付', ts: order.deliveredAt },
              { zh: '你確認收到', ts: order.completedAt },
            ].map((s, i, arr) => {
              const cur4 = { pending: 0, approved: 1, delivered: 2, completed: 3 } as Record<string, number>;
              const c = cur4[order.status] ?? 0;
              const done = i < c;
              const current = i === c;
              const last = i === arr.length - 1;
              return (
                <View key={s.zh} style={styles.stepRow4}>
                  {!last && (
                    <View
                      style={[
                        styles.stepLine4,
                        { backgroundColor: done ? P.green : P.border },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.stepDot4,
                      done
                        ? { backgroundColor: P.green, borderColor: P.green }
                        : current
                        ? { backgroundColor: P.primary, borderColor: P.primary }
                        : { backgroundColor: P.surface, borderColor: P.border },
                    ]}
                  >
                    <BodySm
                      style={{
                        color: done ? P.bg : current ? P.bg : P.muted,
                        fontWeight: '800',
                        fontSize: 13,
                      }}
                    >
                      {done ? '✓' : i + 1}
                    </BodySm>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <H3 style={{ fontSize: 15, color: done || current ? P.text : P.muted }}>
                      {s.zh}
                    </H3>
                    <Muted style={{ fontSize: 11, marginTop: 2 }}>{fmtWhen(s.ts)}</Muted>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {declined && (order as any).parentNote && (
          <View style={styles.declinedBox}>
            <Label style={{ color: P.accent }}>爸媽說</Label>
            <Body style={{ marginTop: 6, lineHeight: 22 }}>
              {(order as any).parentNote}
            </Body>
          </View>
        )}
      </ScrollView>
      {/* Footer: two buttons */}
      <View style={styles.footer}>
        <Pressable
          onPress={order.status === 'pending' ? handleCancel : onClose}
          disabled={submitting}
          style={[styles.cancelBtn, submitting && { opacity: 0.6 }]}
        >
          <Label style={{ color: P.muted, fontSize: 14 }}>
            {order.status === 'pending' ? '取消訂單' : '回到主頁'}
          </Label>
        </Pressable>
        <Pressable
          onPress={
            order.status === 'approved' || order.status === 'delivered'
              ? handleReceived
              : onClose
          }
          style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
          disabled={submitting}
        >
          <Label style={{ color: P.bg, fontSize: 14, fontWeight: '800' }}>
            {order.status === 'approved' || order.status === 'delivered'
              ? submitting
                ? '確認中…'
                : '✓ 我拿到了！'
              : '回到任務'}
          </Label>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  closeRound: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(247,242,234,0.08)',
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardRow: {
    marginTop: spacing.lg,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  rewardEmojiBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps4: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    paddingHorizontal: 6,
  },
  stepRow4: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
    position: 'relative',
  },
  stepLine4: {
    position: 'absolute',
    left: 13,
    top: 28,
    bottom: -4,
    width: 2,
  },
  stepDot4: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  cancelBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
  },
  sheetHeader: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(247,242,234,0.25)',
  },
  closeBtn: {
    position: 'absolute',
    right: 18,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(247,242,234,0.08)',
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroEmojiBox: {
    width: 92,
    height: 92,
    borderRadius: 22,
    backgroundColor: `${P.primary}33`,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  stepsBox: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
    position: 'relative',
  },
  stepLine: {
    position: 'absolute',
    left: 13,
    top: 28,
    bottom: -4,
    width: 2,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  declinedBox: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: `${P.accent}18`,
    borderWidth: 1,
    borderColor: `${P.accent}33`,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: P.border,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: P.bg,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
    shadowColor: P.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
