import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type {
  TaskInstance,
  TaskSubmission,
  RewardOrder,
  RewardItem,
} from '../../../types/models';
import { useFamily } from '../../../hooks/useFamily';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import { RoughStar } from '../../../design/RoughStar';
import { Empty } from '../../../design/Empty';
import {
  Display,
  H3,
  Body,
  Label,
  Muted,
  Data,
} from '../../../design/Text';

type ReviewTask = {
  instance: TaskInstance;
  submission: TaskSubmission;
  taskTitle: string;
  taskPoints: number;
  childName: string;
};

type ReviewOrder = {
  order: RewardOrder;
  item: RewardItem | null;
  childName: string;
};

const emojiFor = (title: string): string => {
  const t = title || '';
  if (/刷牙|牙/.test(t)) return '🦷';
  if (/書|讀|書桌/.test(t)) return '📚';
  if (/洗|澡/.test(t)) return '🛁';
  if (/垃圾|倒|清/.test(t)) return '🧹';
  if (/衣|服/.test(t)) return '👕';
  if (/碗|盤|餐/.test(t)) return '🍽';
  if (/運動|跑/.test(t)) return '🏃';
  if (/畫/.test(t)) return '🎨';
  if (/作業|功課|寫|算/.test(t)) return '📝';
  return '✦';
};

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

const CHILD_PALETTE = ['#F5A623', '#5EE0A8', '#6FA9E8', '#8B7ED8', '#FF6B47', '#FFD966'] as const;
const childColorFor = (userId: string): string => {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return CHILD_PALETTE[h % CHILD_PALETTE.length];
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

const fmtTimeOfDay = (ts: any): string => {
  if (!ts) return '';
  const d: Date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function ParentReview() {
  const uid = auth().currentUser?.uid;
  const { family } = useFamily(uid);
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);
  const [reviewOrders, setReviewOrders] = useState<ReviewOrder[]>([]);
  const [activeTask, setActiveTask] = useState<ReviewTask | null>(null);
  const [activeOrder, setActiveOrder] = useState<ReviewOrder | null>(null);

  useEffect(() => {
    if (!family) return;
    const unsub = firestore()
      .collection('taskInstances')
      .where('familyId', '==', family.id)
      .where('status', '==', 'submitted')
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const list: ReviewTask[] = [];
        for (const doc of snap.docs) {
          const instance = { id: doc.id, ...doc.data() } as TaskInstance;
          const subSnap = await firestore()
            .collection('taskSubmissions')
            .where('taskInstanceId', '==', instance.id)
            .orderBy('submittedAt', 'desc')
            .limit(1)
            .get();
          if (subSnap.empty) continue;
          const submission = {
            id: subSnap.docs[0].id,
            ...subSnap.docs[0].data(),
          } as TaskSubmission;
          const taskDoc = await firestore()
            .collection('tasks')
            .doc(instance.taskId)
            .get();
          const taskData = taskDoc.data();
          const userDoc = await firestore()
            .collection('users')
            .doc(instance.userId)
            .get();
          list.push({
            instance,
            submission,
            taskTitle: taskData?.title || '—',
            taskPoints: taskData?.points || 0,
            childName: userDoc.data()?.displayName || '小朋友',
          });
        }
        setReviewTasks(list);
      });
    return unsub;
  }, [family?.id]);

  useEffect(() => {
    if (!family) return;
    const unsub = firestore()
      .collection('rewardOrders')
      .where('familyId', '==', family.id)
      .where('status', '==', 'pending')
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const list: ReviewOrder[] = [];
        for (const doc of snap.docs) {
          const order = { id: doc.id, ...doc.data() } as RewardOrder;
          const itemDoc = await firestore()
            .collection('rewardItems')
            .doc(order.itemId)
            .get();
          const itemData = itemDoc.data();
          const userDoc = await firestore()
            .collection('users')
            .doc(order.userId)
            .get();
          list.push({
            order,
            item: itemData
              ? ({ id: itemDoc.id, ...itemData } as RewardItem)
              : null,
            childName: userDoc.data()?.displayName || '小朋友',
          });
        }
        setReviewOrders(list);
      });
    return unsub;
  }, [family?.id]);

  const total = reviewTasks.length + reviewOrders.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Starfield count={12} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <Label color={P.muted}>審核</Label>
          <Display style={{ marginTop: 2 }}>
            {total === 0 ? '都審完了 🎉' : `${total} 個等你看`}
          </Display>
        </View>

        {reviewOrders.length > 0 && (
          <View style={styles.section}>
            <Label color={P.muted} style={{ marginBottom: spacing.sm }}>
              禮物申請
            </Label>
            {reviewOrders.map((o) => (
              <Pressable
                key={o.order.id}
                onPress={() => setActiveOrder(o)}
                style={styles.orderCard}
              >
                <View style={styles.orderIcon}>
                  <Body style={{ fontSize: 26 }}>
                    {rewardEmoji(o.item?.title || '')}
                  </Body>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Label style={{ color: '#8A8275' }}>
                    {o.childName} 想換
                  </Label>
                  <H3 style={{ fontSize: 15, marginTop: 2, color: '#1C1A14' }}>
                    {o.item?.title || '—'}
                  </H3>
                  <Data
                    style={{
                      fontSize: 13,
                      marginTop: 4,
                      color: '#1C1A14',
                      fontWeight: '700',
                    }}
                  >
                    −★ {o.order.pointCostSnapshot}
                  </Data>
                </View>
                <Body style={{ color: '#8A8275', fontSize: 18 }}>›</Body>
              </Pressable>
            ))}
          </View>
        )}

        {reviewTasks.length > 0 && (
          <View style={styles.section}>
            <Label color={P.muted} style={{ marginBottom: spacing.sm }}>
              任務
            </Label>
            {reviewTasks.map((it) => (
              <Pressable
                key={it.instance.id}
                onPress={() => setActiveTask(it)}
                style={styles.taskCard}
              >
                <View style={styles.taskCardInner}>
                  <View style={styles.photoThumb}>
                    {it.submission.photoUrls[0] ? (
                      <Image
                        source={{ uri: it.submission.photoUrls[0] }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Body
                      style={{
                        fontSize: 22,
                        position: 'absolute',
                        right: 6,
                        bottom: 6,
                        opacity: 0.8,
                      }}
                    >
                      {emojiFor(it.taskTitle)}
                    </Body>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.rowBetween}>
                      <H3 numberOfLines={1} style={{ fontSize: 15, flex: 1 }}>
                        {it.taskTitle}
                      </H3>
                      <Data
                        style={{
                          color: P.primary,
                          fontSize: 13,
                          fontWeight: '700',
                        }}
                      >
                        ★ {it.taskPoints}
                      </Data>
                    </View>
                    <View style={styles.childRow}>
                      <View
                        style={[
                          styles.childDot,
                          { backgroundColor: childColorFor(it.instance.userId) },
                        ]}
                      />
                      <Muted style={{ fontSize: 11 }}>
                        {it.childName} · {fmtWhen(it.submission.submittedAt)}
                      </Muted>
                    </View>
                    {(it.instance.submissionCount || 0) > 1 && (
                      <Muted style={{ fontSize: 10, marginTop: 4 }}>
                        第 {it.instance.submissionCount}/3 次
                      </Muted>
                    )}
                    {it.submission.childNote ? (
                      <Muted style={{ fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                        「{it.submission.childNote}」
                      </Muted>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {total === 0 && (
          <Empty
            emoji="🌙"
            title="休息一下"
            body="小孩做完任務之後，會跑到這裡等你看。"
          />
        )}
      </ScrollView>

      <ReviewTaskSheet
        item={activeTask}
        uid={uid}
        onClose={() => setActiveTask(null)}
      />
      <RedeemConfirmSheet
        order={activeOrder}
        familyId={family?.id}
        uid={uid}
        onClose={() => setActiveOrder(null)}
      />
    </SafeAreaView>
  );
}

// =============================================================================
// Review Task Sheet — spec 4.3
// =============================================================================
function ReviewTaskSheet({
  item,
  uid,
  onClose,
}: {
  item: ReviewTask | null;
  uid: string | undefined;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!item) setNote('');
  }, [item]);

  if (!item) return null;

  const handleApprove = async () => {
    await firestore()
      .collection('taskInstances')
      .doc(item.instance.id)
      .update({
        status: 'approved',
        reviewedBy: uid,
        reviewedAt: firestore.FieldValue.serverTimestamp(),
        ...(note.trim() ? { parentNote: note.trim() } : {}),
      });
    onClose();
  };

  const handleReject = async () => {
    const currentCount = item.instance.submissionCount || 0;
    const newStatus = currentCount >= 3 ? 'missed' : 'rejected';
    const updates: Record<string, any> = {
      status: newStatus,
      reviewedBy: uid,
      reviewedAt: firestore.FieldValue.serverTimestamp(),
    };
    if (note.trim()) updates.parentNote = note.trim();
    await firestore()
      .collection('taskInstances')
      .doc(item.instance.id)
      .update(updates);
    if (note.trim()) {
      await firestore()
        .collection('taskSubmissions')
        .doc(item.submission.id)
        .update({ rejectNote: note.trim() });
    }
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      visible={!!item}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={sheetStyles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={20}
        >
          <View style={sheetStyles.dragBar} />
          <View style={sheetStyles.topRow}>
            <View style={{ width: 32 }} />
            <View />
            <Pressable onPress={onClose} hitSlop={10} style={sheetStyles.closeBtn}>
              <Body style={{ color: P.muted, fontSize: 22 }}>✕</Body>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={sheetStyles.header}>
              <View style={sheetStyles.avatarRow}>
                <View
                  style={[
                    sheetStyles.childAvatar,
                    { backgroundColor: childColorFor(item.instance.userId) },
                  ]}
                />
                <Muted style={{ fontSize: 12 }}>{item.childName} 提交</Muted>
              </View>
              <H3 style={sheetStyles.taskTitle}>{item.taskTitle}</H3>
            </View>

            {/* 照片 4:3 */}
            <View style={sheetStyles.photoBox}>
              {item.submission.photoUrls[0] ? (
                <Image
                  source={{ uri: item.submission.photoUrls[0] }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              ) : (
                <View style={sheetStyles.photoFallback} />
              )}
              <View style={sheetStyles.photoEmoji}>
                <Body style={{ fontSize: 46, opacity: 0.6 }}>{emojiFor(item.taskTitle)}</Body>
              </View>
              <View style={sheetStyles.photoStamp}>
                <Muted style={{ color: '#fff', fontSize: 11 }}>
                  {fmtTimeOfDay(item.submission.submittedAt)}
                </Muted>
              </View>
            </View>

            {/* 孩子備註 */}
            {item.submission.childNote ? (
              <View style={sheetStyles.noteCard}>
                <Label style={{ color: P.muted, fontSize: 11 }}>
                  {item.childName} 說：
                </Label>
                <Body style={{ fontSize: 13, marginTop: 4, lineHeight: 20 }}>
                  「{item.submission.childNote}」
                </Body>
              </View>
            ) : null}

            {/* 家長回覆 */}
            <View style={sheetStyles.replyCard}>
              <Label style={{ color: P.muted, fontSize: 11, marginBottom: 8 }}>
                回一句話（選填）
              </Label>
              <TextInput
                style={sheetStyles.replyInput}
                placeholder="例：做得很好！"
                placeholderTextColor={P.muted}
                value={note}
                onChangeText={setNote}
                multiline
              />
              <View style={sheetStyles.quickChips}>
                {['做得很好！', '下次再仔細一點', '👍', '👏', '要重做喔'].map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setNote(c)}
                    style={sheetStyles.quickChip}
                  >
                    <Label style={{ color: P.primary, fontSize: 11 }}>{c}</Label>
                  </Pressable>
                ))}
              </View>
            </View>

            {(item.instance.submissionCount || 0) > 1 && (
              <Muted style={{ fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                第 {item.instance.submissionCount}/3 次
              </Muted>
            )}
          </ScrollView>

          {/* 底部双按鈕 */}
          <View style={sheetStyles.footerRow}>
            <Pressable onPress={handleReject} style={sheetStyles.rejectBtn}>
              <Label style={{ color: P.accentHot, fontSize: 14 }}>↺ 再試一次</Label>
            </Pressable>
            <Pressable onPress={handleApprove} style={sheetStyles.approveBtn}>
              <RoughStar size={14} color={P.bg} glow={false} />
              <Label style={{ color: P.bg, marginLeft: 6, fontSize: 14, fontWeight: '800' }}>
                通過 +★ {item.taskPoints}
              </Label>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// =============================================================================
// Redeem Confirm Sheet — spec 4.4
// =============================================================================
function RedeemConfirmSheet({
  order,
  familyId,
  uid,
  onClose,
}: {
  order: ReviewOrder | null;
  familyId: string | undefined;
  uid: string | undefined;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!order) {
      setNote('');
      setBalance(null);
      return;
    }
    if (!familyId) return;
    firestore()
      .collection('pointWallets')
      .doc(`${familyId}_${order.order.userId}`)
      .get()
      .then((d) => setBalance(d.data()?.balance ?? null))
      .catch(() => setBalance(null));
  }, [order, familyId]);

  if (!order) return null;

  const handleApprove = async () => {
    await firestore()
      .collection('rewardOrders')
      .doc(order.order.id)
      .update({
        status: 'approved',
        approvedAt: firestore.FieldValue.serverTimestamp(),
        ...(note.trim() ? { parentNote: note.trim() } : {}),
      });
    Keyboard.dismiss();
    onClose();
  };

  const handleReject = async () => {
    if (!note.trim()) {
      // 留言必填（spec 4.4 提到）
      return;
    }
    await firestore()
      .collection('rewardOrders')
      .doc(order.order.id)
      .update({
        status: 'rejected',
        parentNote: note.trim(),
      });
    Keyboard.dismiss();
    onClose();
  };

  const cost = order.order.pointCostSnapshot;
  const afterBalance = balance != null ? balance - cost : null;

  return (
    <Modal
      visible={!!order}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={sheetStyles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={20}
        >
          <View style={sheetStyles.dragBar} />
          <View style={sheetStyles.topRow}>
            <View style={{ width: 32 }} />
            <View />
            <Pressable onPress={onClose} hitSlop={10} style={sheetStyles.closeBtn}>
              <Body style={{ color: P.muted, fontSize: 22 }}>✕</Body>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={sheetStyles.header}>
              <H3 style={[sheetStyles.taskTitle, { fontSize: 24 }]}>
                {order.childName} 想要換…
              </H3>
            </View>

            {/* 反白卡片（surfaceCream） */}
            <View style={sheetStyles.creamCard}>
              <View style={sheetStyles.rewardIcon}>
                <Body style={{ fontSize: 52 }}>
                  {order.item?.emoji || rewardEmoji(order.item?.title || '')}
                </Body>
              </View>
              <H3 style={sheetStyles.rewardName}>{order.item?.title || '—'}</H3>
              <Data style={sheetStyles.rewardCost}>− ★ {cost}</Data>

              {/* 星光對比 */}
              <View style={sheetStyles.balanceRow}>
                <View style={sheetStyles.balancePill}>
                  <Label style={{ color: '#8A8275', fontSize: 10 }}>現在</Label>
                  <Data style={{ color: '#1C1A14', fontSize: 16, fontWeight: '700' }}>
                    ★ {balance ?? '—'}
                  </Data>
                </View>
                <Body style={{ fontSize: 18, color: '#8A8275' }}>→</Body>
                <View style={sheetStyles.balancePill}>
                  <Label style={{ color: '#8A8275', fontSize: 10 }}>之後</Label>
                  <Data
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: afterBalance != null && afterBalance < 0 ? P.accentHot : '#1C1A14',
                    }}
                  >
                    ★ {afterBalance ?? '—'}
                  </Data>
                </View>
              </View>
            </View>

            {/* 留言（婉拒時必填） */}
            <View style={sheetStyles.replyCard}>
              <Label style={{ color: P.muted, fontSize: 11, marginBottom: 8 }}>
                寫點什麼（婉拒時必填）
              </Label>
              <TextInput
                style={sheetStyles.replyInput}
                placeholder="例：好啊！記得收拾"
                placeholderTextColor={P.muted}
                value={note}
                onChangeText={setNote}
                multiline
              />
              <View style={sheetStyles.quickChips}>
                {['好啊！', '今天再說', '寫完功課再說', '不行，太多了'].map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setNote(c)}
                    style={[sheetStyles.quickChip, { backgroundColor: `${P.accent}38` }]}
                  >
                    <Label style={{ color: P.accent, fontSize: 11 }}>{c}</Label>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={sheetStyles.footerRow}>
            <Pressable
              onPress={handleReject}
              disabled={!note.trim()}
              style={[sheetStyles.declineBtn, !note.trim() && { opacity: 0.5 }]}
            >
              <Label style={{ color: P.text, fontSize: 14 }}>晚點再說</Label>
            </Pressable>
            <Pressable onPress={handleApprove} style={[sheetStyles.approveBtn, { flex: 2 }]}>
              <Label style={{ color: P.bg, fontSize: 14, fontWeight: '800' }}>
                好，答應她
              </Label>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  scroll: { paddingBottom: 120 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  orderCard: {
    padding: 14,
    backgroundColor: P.surfaceCream,
    borderRadius: radius.card,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5A62333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCard: {
    padding: 14,
    backgroundColor: P.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 8,
  },
  taskCardInner: {
    flexDirection: 'row',
    gap: 12,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#8A7A54',
    overflow: 'hidden',
    position: 'relative',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  childDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

const sheetStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: P.bg,
  },
  dragBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: P.border,
    marginTop: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  childAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  taskTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  photoBox: {
    marginHorizontal: spacing.lg,
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: '#8A7A54',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.md,
  },
  photoFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#8A7A54',
  },
  photoEmoji: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  photoStamp: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  noteCard: {
    marginHorizontal: spacing.lg,
    padding: 14,
    borderRadius: 12,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: spacing.md,
  },
  replyCard: {
    marginHorizontal: spacing.lg,
    padding: 14,
    borderRadius: 14,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
  },
  replyInput: {
    backgroundColor: P.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: P.border,
    padding: 12,
    color: P.text,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  quickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: `${P.primary}38`,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.accentHot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: P.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creamCard: {
    marginHorizontal: spacing.lg,
    padding: 22,
    borderRadius: 22,
    backgroundColor: P.surfaceCream,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rewardIcon: {
    width: 96,
    height: 96,
    borderRadius: 22,
    backgroundColor: `${P.primary}55`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  rewardName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1A14',
  },
  rewardCost: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1A14',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  balancePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(28,26,20,0.06)',
    alignItems: 'center',
    minWidth: 80,
  },
});
