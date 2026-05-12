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
      setSubmitting(false);
    }
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
      <View style={styles.sheetHeader}>
        <View style={styles.sheetHandle} />
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
          <Body style={{ color: P.muted }}>✕</Body>
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Label color={P.muted} style={{ textAlign: 'center' }}>
          獎勵路程
        </Label>
        <View style={styles.heroEmojiBox}>
          <Body style={{ fontSize: 48 }}>{rewardEmoji(item.title)}</Body>
        </View>
        <Display style={{ fontSize: 22, textAlign: 'center', marginTop: spacing.md }}>
          {item.title}
        </Display>
        <Body style={{ color: P.muted, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
          {order.status === 'pending' && '⏳ 等爸媽答應'}
          {order.status === 'approved' && '✓ 馬上就到你手上'}
          {order.status === 'delivered' && '🎁 送到了，確認收到'}
          {order.status === 'completed' && '🎊 拿到了！'}
          {declined && `💬 ${order.parentNote || '爸媽沒答應'}`}
        </Body>

        {!declined && (
          <View style={styles.stepsBox}>
            {steps.map((s, i) => {
              const done = i <= cur;
              const current = i === cur;
              return (
                <View key={s.k} style={styles.stepRow}>
                  {i < steps.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        { backgroundColor: done ? P.primary : P.border },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor: done ? P.primary : P.surface,
                        borderColor: done ? P.primary : P.border,
                        ...(current
                          ? {
                              shadowColor: P.primary,
                              shadowOpacity: 0.35,
                              shadowRadius: 12,
                              elevation: 6,
                            }
                          : {}),
                      },
                    ]}
                  >
                    <BodySm
                      style={{
                        color: done ? P.bg : P.muted,
                        fontWeight: '800',
                        fontSize: 13,
                      }}
                    >
                      {done ? '✓' : i + 1}
                    </BodySm>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <H3
                      style={{
                        fontSize: 14,
                        color: done ? P.text : P.muted,
                      }}
                    >
                      {s.zh}
                    </H3>
                    <Muted style={{ fontSize: 11, marginTop: 2 }}>
                      {fmtWhen(s.ts)}
                    </Muted>
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
      <View style={styles.footer}>
        {(order.status === 'approved' || order.status === 'delivered') ? (
          <Pressable
            onPress={handleReceived}
            style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
            disabled={submitting}
          >
            <Label style={{ color: P.bg, fontSize: 14 }}>
              {submitting ? '確認中…' : '✓ 我拿到了！'}
            </Label>
          </Pressable>
        ) : (
          <Pressable onPress={onClose} style={styles.primaryBtn}>
            <Label style={{ color: P.bg, fontSize: 14 }}>好</Label>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    alignItems: 'center',
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
