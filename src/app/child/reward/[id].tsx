import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import type { RewardItem, PointWallet } from '../../../types/models';
import { useAuth } from '../../../hooks/useAuth';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import { RoughStar } from '../../../design/RoughStar';
import {
  Display,
  H2,
  Body,
  BodySm,
  Label,
  Muted,
  Data,
} from '../../../design/Text';

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

export default function RewardConfirm() {
  const { id: rewardId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.id;

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [item, setItem] = useState<RewardItem | null>(null);
  const [wallet, setWallet] = useState<PointWallet | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      }, (err) => console.error('[RewardDetail] membership error:', (err as any)?.code));
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!rewardId) return;
    firestore()
      .collection('rewardItems')
      .doc(rewardId)
      .get()
      .then((doc) => {
        const data = doc.data();
        if (data) setItem({ id: doc.id, ...data } as RewardItem);
      });
  }, [rewardId]);

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
      }, (err) => console.error('[RewardDetail] wallet error:', (err as any)?.code));
    return unsub;
  }, [uid, familyId]);

  const onClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/child/(tabs)/rewards');
  };

  const handleConfirm = async () => {
    if (!uid || !familyId || !item) return;
    const balance = wallet?.balance || 0;
    if (balance < item.pointCost) {
      Alert.alert('星光不夠', '再努力完成任務攢星光吧！');
      return;
    }
    try {
      setSubmitting(true);
      const docRef = await firestore().collection('rewardOrders').add({
        familyId,
        itemId: item.id,
        userId: uid,
        pointCostSnapshot: item.pointCost,
        status: 'pending',
        cancelledAt: null,
        approvedAt: null,
        deliveredAt: null,
        completedAt: null,
        autoCompleteAt: null,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      router.replace(`/child/order/${docRef.id}` as any);
    } catch (e) {
      Alert.alert('出錯了', '檢查網路再試一次。');
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) {
    return (
      <SafeAreaView style={styles.safe}>
        <Starfield count={20} />
      </SafeAreaView>
    );
  }

  const balance = wallet?.balance || 0;
  const after = Math.max(0, balance - item.pointCost);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Starfield count={24} />
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
        <Label style={{ color: P.accent, textAlign: 'center' }}>
          要換這個嗎？
        </Label>
        <View style={styles.heroEmojiBox}>
          <Body style={{ fontSize: 52 }}>{rewardEmoji(item.title)}</Body>
        </View>
        <Display style={{ fontSize: 26, textAlign: 'center', marginTop: spacing.md }}>
          {item.title}
        </Display>
        {item.description ? (
          <Muted style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {item.description}
          </Muted>
        ) : null}
        <View style={styles.costRow}>
          <RoughStar size={22} />
          <Data
            style={{
              color: P.primary,
              fontSize: 26,
              fontWeight: '700',
              marginLeft: 6,
            }}
          >
            −{item.pointCost}
          </Data>
        </View>

        <View style={styles.beforeAfter}>
          <View>
            <Label color={P.muted}>現在</Label>
            <Data style={{ fontSize: 20, fontWeight: '700', marginTop: 2 }}>
              ★ {balance}
            </Data>
          </View>
          <Body style={{ color: P.muted, fontSize: 20 }}>→</Body>
          <View style={{ alignItems: 'flex-end' }}>
            <Label color={P.muted}>之後</Label>
            <Data style={{ fontSize: 20, fontWeight: '700', marginTop: 2 }}>
              ★ {after}
            </Data>
          </View>
        </View>

        <Muted style={{ textAlign: 'center', marginTop: spacing.md, fontSize: 12 }}>
          爸媽要先說好才算完成
        </Muted>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={onClose} style={styles.secondaryBtn}>
          <Label style={{ color: P.muted }}>再想想</Label>
        </Pressable>
        <Pressable
          onPress={handleConfirm}
          disabled={submitting}
          style={styles.primaryBtn}
        >
          <Label style={{ color: P.bg, fontSize: 14 }}>✓ 問爸媽</Label>
        </Pressable>
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
    paddingTop: spacing.md,
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  heroEmojiBox: {
    width: 100,
    height: 100,
    borderRadius: 22,
    backgroundColor: `${P.primary}33`,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    shadowColor: P.primary,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  beforeAfter: {
    marginTop: spacing.lg,
    width: '100%',
    maxWidth: 280,
    padding: spacing.md,
    backgroundColor: P.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
  },
  primaryBtn: {
    flex: 1.5,
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
