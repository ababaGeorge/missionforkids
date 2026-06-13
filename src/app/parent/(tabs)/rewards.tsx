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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { RewardItem, RewardOrder } from '../../../types/models';
import { resolveMemberDisplay } from '../../../lib/memberName';
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

const REWARD_COLORS = ['#FFD966', '#F5A623', '#5EE0A8', '#6FA9E8', '#8B7ED8', '#FF6B47'] as const;
const colorForReward = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return REWARD_COLORS[h % REWARD_COLORS.length];
};

const fmtMonth = (ts: any): string => {
  if (!ts) return '—';
  const d: Date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

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
  const [tab, setTab] = useState<'catalog' | 'log'>('catalog');
  const [editingItem, setEditingItem] = useState<RewardItem | null>(null);

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
      .orderBy('createdAt', 'desc')
      .limit(50)
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
            const r = await resolveMemberDisplay(
              familyId as string,
              order.userId,
              ''
            );
            childName = r.name;
          } catch {}
          list.push({ order, itemTitle, childName });
        }
        setOrders(list);
      }, (err) => {
        // A8：缺索引/權限錯誤不再被吞掉。沒有這個 callback 時 FAILED_PRECONDITION
        // 會讓訂單列表永遠空白且 console 無痕跡。
        console.error('[rewards] 訂單列表載入失敗:', (err as any)?.code || err);
        setOrders([]);
      });
    return unsub;
  }, [familyId]);

  const handleDeliverOrder = (orderId: string) => {
    Alert.alert('確認交付', '已經把禮物交給孩子了嗎？', [
      { text: '還沒', style: 'cancel' },
      {
        text: '已交付',
        onPress: async () => {
          try {
            const now = new Date();
            const autoComplete = new Date(now.getTime() + 72 * 60 * 60 * 1000);
            await firestore().collection('rewardOrders').doc(orderId).update({
              status: 'delivered',
              deliveredAt: firestore.Timestamp.fromDate(now),
              autoCompleteAt: firestore.Timestamp.fromDate(autoComplete),
            });
          } catch (e: any) {
            Alert.alert('失敗', e?.message || '不明錯誤');
          }
        },
      },
    ]);
  };

  const monthStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const inMonth = orders.filter((o) => {
      const t = (o.order.createdAt as any)?.toMillis?.() || 0;
      return t >= monthStart;
    });
    const done = inMonth.filter((o) =>
      ['delivered', 'completed', 'approved'].includes(o.order.status)
    ).length;
    const points = inMonth
      .filter((o) => ['delivered', 'completed', 'approved'].includes(o.order.status))
      .reduce((s, o) => s + (o.order.pointCostSnapshot || 0), 0);
    return { done, points };
  }, [orders]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Starfield count={12} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Label color={P.muted}>獎勵</Label>
          <Display style={{ marginTop: 2 }}>管理與紀錄</Display>

          <View style={styles.segment}>
            {(['catalog', 'log'] as const).map((k) => {
              const on = tab === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setTab(k)}
                  style={[styles.segmentItem, on && styles.segmentItemOn]}
                >
                  <Label
                    style={{
                      color: on ? P.bg : P.muted,
                      fontSize: 12,
                    }}
                  >
                    {k === 'catalog' ? '禮物目錄' : '兌換紀錄'}
                  </Label>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          {tab === 'catalog' ? (
            items.length === 0 ? (
              <>
                <Empty emoji="🎁" title="還沒有禮物" body="點下方按鈕新增一個" />
                <Pressable
                  onPress={() => { setEditingItem(null); setShowCreate(true); }}
                  style={styles.addDashed}
                >
                  <Label style={styles.addDashedLabel}>+ 新增禮物</Label>
                </Pressable>
              </>
            ) : (
              <>
                {items.map((r) => {
                  const color = colorForReward(r.id);
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => { setEditingItem(r); setShowCreate(true); }}
                      style={styles.itemRow}
                    >
                      <View style={[styles.itemIcon, { backgroundColor: `${color}33`, borderColor: `${color}88` }]}>
                        <Body style={{ fontSize: 22 }}>{r.emoji || rewardEmoji(r.title)}</Body>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <H3 style={{ fontSize: 14 }} numberOfLines={1}>{r.title}</H3>
                        {r.description ? (
                          <Muted style={{ fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                            {r.description}
                          </Muted>
                        ) : null}
                      </View>
                      <View style={styles.itemRight}>
                        <Data style={styles.itemPrice}>★ {r.pointCost}</Data>
                        <Muted style={{ fontSize: 10, marginTop: 2 }}>編輯 →</Muted>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => { setEditingItem(null); setShowCreate(true); }}
                  style={styles.addDashed}
                >
                  <Label style={styles.addDashedLabel}>+ 新增禮物</Label>
                </Pressable>
              </>
            )
          ) : (
            // Redeem log
            orders.length === 0 ? (
              <Empty emoji="📜" title="還沒有兌換" body="小孩兌換禮物會出現在這。" />
            ) : (
              <>
                {orders.map((o) => {
                  const isDeliverable = o.order.status === 'approved';
                  const statusInfo = (() => {
                    switch (o.order.status) {
                      case 'pending': return { text: '等你確認', color: P.accent };
                      case 'approved': return { text: '準備交付', color: P.accent };
                      case 'delivered': return { text: '已交付', color: P.green };
                      case 'completed': return { text: '完成', color: P.green };
                      case 'cancelled': return { text: '取消', color: P.muted };
                      case 'rejected': return { text: '婉拒', color: P.accentHot };
                      default: return { text: o.order.status, color: P.muted };
                    }
                  })();
                  return (
                    <View key={o.order.id} style={styles.logRow}>
                      <View style={styles.logIcon}>
                        <Body style={{ fontSize: 20 }}>{rewardEmoji(o.itemTitle)}</Body>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <H3 style={{ fontSize: 13 }} numberOfLines={1}>
                          {o.itemTitle || '—'}
                        </H3>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
                          <Muted style={{ fontSize: 11 }}>
                            {o.childName} · {fmtMonth(o.order.createdAt)} ·
                          </Muted>
                          <Label style={{ fontSize: 11, color: statusInfo.color, marginLeft: 4 }}>
                            {statusInfo.text}
                          </Label>
                        </View>
                      </View>
                      <Data style={{ color: P.muted, fontSize: 13, fontWeight: '700' }}>
                        − ★ {o.order.pointCostSnapshot}
                      </Data>
                      {isDeliverable && (
                        <Pressable
                          onPress={() => handleDeliverOrder(o.order.id)}
                          style={styles.deliverBtn}
                          hitSlop={6}
                        >
                          <Label style={{ color: P.bg, fontSize: 11 }}>已交付</Label>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                <Muted style={styles.monthStats}>
                  本月：{monthStats.done} 次 · − ★ {monthStats.points}
                </Muted>
              </>
            )
          )}
        </View>
      </ScrollView>

      {tab === 'catalog' && (
        <Pressable
          onPress={() => { setEditingItem(null); setShowCreate(true); }}
          style={styles.fab}
          hitSlop={10}
        >
          <Body style={{ color: P.bg, fontSize: 26, fontWeight: '800' }}>+</Body>
        </Pressable>
      )}

      <CreateRewardModal
        visible={showCreate}
        onClose={() => { setShowCreate(false); setEditingItem(null); }}
        familyId={familyId}
        uid={uid}
        editing={editingItem}
      />
    </SafeAreaView>
  );
}

function CreateRewardModal({
  visible,
  onClose,
  familyId,
  uid,
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  familyId: string | null;
  uid: string | undefined;
  editing?: RewardItem | null;
}) {
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('50');
  const [emoji, setEmoji] = useState('🎁');
  const [itemType, setItemType] = useState<'physical' | 'virtual'>('physical');

  useEffect(() => {
    if (visible) {
      if (editing) {
        setTitle(editing.title);
        setCost(String(editing.pointCost));
        setEmoji(editing.emoji || '🎁');
        setItemType(editing.itemType);
      } else {
        setTitle('');
        setCost('50');
        setEmoji('🎁');
        setItemType('physical');
      }
    }
  }, [visible, editing]);

  const handleCreate = async () => {
    if (!familyId || !uid || !title.trim()) return;
    const payload = {
      title: title.trim(),
      pointCost: parseInt(cost) || 50,
      itemType,
      emoji,
    };
    try {
      if (editing) {
        await firestore().collection('rewardItems').doc(editing.id).update(payload);
      } else {
        await firestore().collection('rewardItems').add({
          familyId,
          description: null,
          imageUrl: null,
          status: 'active',
          createdBy: uid,
          createdAt: firestore.FieldValue.serverTimestamp(),
          ...payload,
        });
      }
      onClose();
    } catch (e: any) {
      Alert.alert(editing ? '更新失敗' : '建立失敗', e?.message || '不明錯誤');
    }
  };

  const handleArchive = () => {
    if (!editing) return;
    Alert.alert('刪除禮物', `確定要刪除「${editing.title}」？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          try {
            await firestore().collection('rewardItems').doc(editing.id).update({ status: 'archived' });
            onClose();
          } catch (e: any) {
            Alert.alert('失敗', e?.message || '不明錯誤');
          }
        },
      },
    ]);
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
                  <H3 style={{ fontSize: 15 }}>{editing ? '編輯禮物' : '新增禮物'}</H3>
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

                {editing && (
                  <Pressable onPress={handleArchive} style={modalStyles.archiveBtn}>
                    <Label style={{ color: P.accentHot, fontSize: 12 }}>刪除這個禮物</Label>
                  </Pressable>
                )}
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
  segment: {
    marginTop: spacing.md,
    flexDirection: 'row',
    backgroundColor: P.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: P.border,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentItemOn: {
    backgroundColor: P.primary,
  },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    backgroundColor: P.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: P.border,
    gap: 12,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    color: P.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  addDashed: {
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: P.border,
    borderRadius: radius.card,
    alignItems: 'center',
    marginTop: 4,
  },
  addDashedLabel: {
    color: P.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 8,
    backgroundColor: P.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: P.border,
  },
  logIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFF1DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthStats: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 11,
  },
  deliverBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    marginLeft: 8,
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
  archiveBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
