import { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { RewardItem, RewardOrder } from '../../../types/models';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import { RoughStar } from '../../../design/RoughStar';
import { Empty } from '../../../design/Empty';
import {
  Display,
  H3,
  Body,
  BodySm,
  Label,
  Muted,
  Data,
} from '../../../design/Text';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - 10) / 2;

const EMOJI_CHOICES = [
  '🎁', '🍦', '🎮', '🎬', '📖', '🧸', '🍕', '🌙', '🎨', '⚽', '🎧', '💰',
];

const rewardEmoji = (title: string): string => {
  const t = title || '';
  if (/遊戲|電玩/.test(t)) return '🎮';
  if (/書|讀/.test(t)) return '📖';
  if (/玩具/.test(t)) return '🧸';
  if (/冰淇淋|甜/.test(t)) return '🍦';
  if (/電影/.test(t)) return '🎬';
  if (/零用|錢/.test(t)) return '💰';
  return '🎁';
};

type OrderWithChild = {
  order: RewardOrder;
  itemTitle: string;
  childName: string;
};

export default function ParentRewards() {
  const uid = auth().currentUser?.uid;
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [orders, setOrders] = useState<OrderWithChild[]>([]);
  const [showCreate, setShowCreate] = useState(false);

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
      }, (err) => console.error('[ParentRewards] membership error:', (err as any)?.code));
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('rewardItems')
      .where('familyId', '==', familyId)
      .where('status', '==', 'active')
      .onSnapshot((snap) => {
        if (!snap) return;
        setItems(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as RewardItem))
        );
      }, (err) => console.error('[ParentRewards] items error:', (err as any)?.code));
    return unsub;
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('rewardOrders')
      .where('familyId', '==', familyId)
      .where('status', 'in', ['pending', 'approved', 'delivered'])
      .orderBy('createdAt', 'desc')
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const list: OrderWithChild[] = [];
        for (const d of snap.docs) {
          const order = { id: d.id, ...d.data() } as RewardOrder;
          let itemTitle = '';
          let childName = '';
          try {
            const itemDoc = await firestore()
              .collection('rewardItems')
              .doc(order.itemId)
              .get();
            itemTitle = itemDoc.data()?.title || '';
          } catch {}
          try {
            const userDoc = await firestore()
              .collection('users')
              .doc(order.userId)
              .get();
            childName = userDoc.data()?.displayName || '';
          } catch {}
          list.push({ order, itemTitle, childName });
        }
        setOrders(list);
      });
    return unsub;
  }, [familyId]);

  const handleDeliverOrder = async (orderId: string) => {
    const now = new Date();
    const autoComplete = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    await firestore().collection('rewardOrders').doc(orderId).update({
      status: 'delivered',
      deliveredAt: firestore.Timestamp.fromDate(now),
      autoCompleteAt: firestore.Timestamp.fromDate(autoComplete),
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Starfield count={12} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Label color={P.muted}>禮物</Label>
          <Display style={{ marginTop: 2 }}>{items.length} 個可以換</Display>
        </View>

        <View style={styles.section}>
          {items.length === 0 ? (
            <Empty emoji="🎁" title="還沒有禮物" body="點右下角 + 新增一個" />
          ) : (
            <View style={styles.grid}>
              {items.map((r) => (
                <View key={r.id} style={styles.card}>
                  <View style={styles.cardEmoji}>
                    <Body style={{ fontSize: 26 }}>{rewardEmoji(r.title)}</Body>
                  </View>
                  <H3 style={{ marginTop: 10, fontSize: 14 }}>{r.title}</H3>
                  <View style={styles.costRow}>
                    <RoughStar size={12} glow={false} />
                    <Data
                      style={{
                        marginLeft: 4,
                        color: P.primary,
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      {r.pointCost}
                    </Data>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {orders.length > 0 && (
          <View style={styles.section}>
            <Label color={P.muted} style={{ marginBottom: spacing.sm }}>
              兌換紀錄
            </Label>
            {orders.map((o) => {
              const isDeliverable = o.order.status === 'approved';
              const statusLabel =
                o.order.status === 'pending'
                  ? '⏳ 等你確認（請到審核）'
                  : o.order.status === 'approved'
                  ? '✓ 準備交付'
                  : '🎊 已交付';
              return (
                <View key={o.order.id} style={styles.orderRow}>
                  <Body style={{ fontSize: 22 }}>
                    {rewardEmoji(o.itemTitle)}
                  </Body>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <H3 style={{ fontSize: 14 }}>{o.itemTitle || '—'}</H3>
                    <Muted style={{ fontSize: 11, marginTop: 2 }}>
                      {o.childName} · {statusLabel}
                    </Muted>
                  </View>
                  <Data
                    style={{
                      color: P.muted,
                      fontSize: 13,
                      fontWeight: '700',
                      marginRight: isDeliverable ? 12 : 0,
                    }}
                  >
                    −★ {o.order.pointCostSnapshot}
                  </Data>
                  {isDeliverable && (
                    <Pressable
                      onPress={() => handleDeliverOrder(o.order.id)}
                      style={styles.deliverBtn}
                    >
                      <Label style={{ color: P.bg, fontSize: 11 }}>
                        已交付
                      </Label>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => setShowCreate(true)}
        style={styles.fab}
        hitSlop={10}
      >
        <Body style={{ color: P.bg, fontSize: 26, fontWeight: '800' }}>+</Body>
      </Pressable>

      <CreateRewardModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        familyId={familyId}
        uid={uid}
      />
    </SafeAreaView>
  );
}

function CreateRewardModal({
  visible,
  onClose,
  familyId,
  uid,
}: {
  visible: boolean;
  onClose: () => void;
  familyId: string | null;
  uid: string | undefined;
}) {
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('50');
  const [emoji, setEmoji] = useState('🎁');
  const [itemType, setItemType] = useState<'physical' | 'virtual'>('physical');

  const handleCreate = async () => {
    if (!familyId || !uid || !title.trim()) return;
    await firestore().collection('rewardItems').add({
      familyId,
      title: title.trim(),
      description: null,
      pointCost: parseInt(cost) || 50,
      itemType,
      imageUrl: null,
      emoji,
      status: 'active',
      createdBy: uid,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    setTitle('');
    setCost('50');
    setEmoji('🎁');
    setItemType('physical');
    onClose();
  };

  const costNum = parseInt(cost) || 0;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.sheet}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={modalStyles.topBar}>
                  <Pressable onPress={onClose}>
                    <Label style={{ color: P.muted }}>取消</Label>
                  </Pressable>
                  <H3 style={{ fontSize: 15 }}>新增禮物</H3>
                  <Pressable
                    onPress={handleCreate}
                    disabled={!title.trim()}
                    style={[
                      modalStyles.saveChip,
                      !title.trim() && { opacity: 0.5 },
                    ]}
                  >
                    <Label style={{ color: P.bg, fontSize: 12 }}>儲存</Label>
                  </Pressable>
                </View>

                <View style={modalStyles.nameCard}>
                  <View style={modalStyles.nameEmoji}>
                    <Body style={{ fontSize: 36 }}>{emoji}</Body>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label color={P.muted}>名字</Label>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="例：吃冰淇淋"
                      placeholderTextColor={P.muted}
                      style={modalStyles.nameInput}
                    />
                  </View>
                </View>

                <View style={modalStyles.box}>
                  <Label color={P.muted} style={{ marginBottom: 10 }}>
                    選個圖案
                  </Label>
                  <View style={modalStyles.emojiGrid}>
                    {EMOJI_CHOICES.map((e) => {
                      const on = emoji === e;
                      return (
                        <Pressable
                          key={e}
                          onPress={() => setEmoji(e)}
                          style={[
                            modalStyles.emojiCell,
                            on && modalStyles.emojiCellOn,
                          ]}
                        >
                          <Body style={{ fontSize: 20 }}>{e}</Body>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={modalStyles.costBox}>
                  <Label color={P.muted}>★ 星光價格</Label>
                  <View style={modalStyles.stepper}>
                    <Pressable
                      onPress={() =>
                        setCost(String(Math.max(5, costNum - 5)))
                      }
                      style={modalStyles.stepBtn}
                    >
                      <Body style={{ color: P.muted, fontSize: 18 }}>−</Body>
                    </Pressable>
                    <Data
                      style={{
                        color: P.primary,
                        fontSize: 22,
                        fontWeight: '700',
                        marginHorizontal: 12,
                        minWidth: 60,
                        textAlign: 'center',
                      }}
                    >
                      ★ {costNum}
                    </Data>
                    <Pressable
                      onPress={() => setCost(String(costNum + 5))}
                      style={modalStyles.stepBtnOn}
                    >
                      <Body style={{ color: P.bg, fontSize: 18, fontWeight: '800' }}>+</Body>
                    </Pressable>
                  </View>
                </View>

                <View style={modalStyles.box}>
                  <Label color={P.muted}>類型</Label>
                  <View style={modalStyles.typeRow}>
                    {(['physical', 'virtual'] as const).map((tp) => {
                      const on = itemType === tp;
                      return (
                        <Pressable
                          key={tp}
                          onPress={() => setItemType(tp)}
                          style={[
                            modalStyles.typeBtn,
                            on && modalStyles.typeBtnOn,
                          ]}
                        >
                          <Label
                            style={{
                              color: on ? P.bg : P.text,
                              fontSize: 12,
                            }}
                          >
                            {tp === 'physical' ? '實體獎勵' : '虛擬獎勵'}
                          </Label>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  scroll: { paddingBottom: 140 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: CARD_WIDTH,
    padding: spacing.md,
    backgroundColor: P.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: P.border,
  },
  cardEmoji: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: `${P.primary}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  orderRow: {
    padding: 12,
    backgroundColor: P.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliverBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: P.primary,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 92,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: P.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: P.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '88%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  saveChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: P.primary,
  },
  nameCard: {
    padding: spacing.md,
    backgroundColor: P.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  nameEmoji: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: `${P.primary}33`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    marginTop: 4,
    padding: 0,
    paddingVertical: 4,
    color: P.text,
    fontSize: 20,
    fontWeight: '700',
    borderBottomWidth: 2,
    borderBottomColor: P.primary,
  },
  box: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: P.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: P.border,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiCell: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: P.bg,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCellOn: {
    backgroundColor: `${P.primary}33`,
    borderWidth: 2,
    borderColor: P.primary,
  },
  costBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: P.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: P.bg,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.surfaceHi,
    alignItems: 'center',
  },
  typeBtnOn: {
    backgroundColor: P.primary,
    borderColor: P.primary,
  },
});
