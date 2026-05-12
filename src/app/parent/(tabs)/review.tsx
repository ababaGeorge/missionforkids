import { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  BodySm,
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

const fmtWhen = (ts: any): string => {
  if (!ts) return '—';
  const d: Date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return d.toLocaleDateString();
};

export default function ParentReview() {
  const uid = auth().currentUser?.uid;
  const { family } = useFamily(uid);
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);
  const [reviewOrders, setReviewOrders] = useState<ReviewOrder[]>([]);
  const [note, setNote] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const handleApproveTask = async (item: ReviewTask) => {
    await firestore()
      .collection('taskInstances')
      .doc(item.instance.id)
      .update({
        status: 'approved',
        reviewedBy: uid,
        reviewedAt: firestore.FieldValue.serverTimestamp(),
      });
    setNote('');
    setRejectingId(null);
    setExpanded(null);
  };

  const handleRejectTask = async (item: ReviewTask) => {
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
    setNote('');
    setRejectingId(null);
    setExpanded(null);
    Keyboard.dismiss();
  };

  const handleApproveOrder = async (o: ReviewOrder) => {
    await firestore()
      .collection('rewardOrders')
      .doc(o.order.id)
      .update({
        status: 'approved',
        approvedAt: firestore.FieldValue.serverTimestamp(),
      });
  };

  const handleRejectOrder = async (o: ReviewOrder) => {
    await firestore()
      .collection('rewardOrders')
      .doc(o.order.id)
      .update({
        status: 'rejected',
        parentNote: note.trim() || null,
      });
    setNote('');
    setExpanded(null);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Starfield count={12} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
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
                <View key={o.order.id}>
                  <Pressable
                    onPress={() =>
                      setExpanded(expanded === o.order.id ? null : o.order.id)
                    }
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
                  {expanded === o.order.id && (
                    <View style={styles.inlineActions}>
                      <Pressable
                        onPress={() => handleRejectOrder(o)}
                        style={styles.rejectBtn}
                      >
                        <Label style={{ color: P.accentHot }}>✕ 拒絕</Label>
                      </Pressable>
                      <Pressable
                        onPress={() => handleApproveOrder(o)}
                        style={styles.approveBtn}
                      >
                        <Label style={{ color: P.bg }}>✓ 同意</Label>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {reviewTasks.length > 0 && (
            <View style={styles.section}>
              <Label color={P.muted} style={{ marginBottom: spacing.sm }}>
                任務
              </Label>
              {reviewTasks.map((it) => (
                <View key={it.instance.id} style={styles.taskCard}>
                  <Pressable
                    onPress={() =>
                      setExpanded(
                        expanded === it.instance.id ? null : it.instance.id
                      )
                    }
                    style={styles.taskCardInner}
                  >
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
                      <Muted style={{ fontSize: 11, marginTop: 2 }}>
                        {it.childName} · {fmtWhen(it.submission.submittedAt)}
                      </Muted>
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
                  </Pressable>

                  {expanded === it.instance.id && (
                    <View style={styles.expandBody}>
                      {it.submission.photoUrls[0] ? (
                        <Image
                          source={{ uri: it.submission.photoUrls[0] }}
                          style={styles.expandPhoto}
                          resizeMode="cover"
                        />
                      ) : null}
                      {rejectingId === it.instance.id ? (
                        <View>
                          <TextInput
                            style={styles.noteInput}
                            placeholder="回一句話（選填）"
                            placeholderTextColor={P.muted}
                            value={note}
                            onChangeText={setNote}
                            multiline
                            autoFocus
                          />
                          <View style={styles.quickChips}>
                            {['做得很好！', '下次再仔細一點', '👍', '👏', '要重做喔'].map(
                              (c) => (
                                <Pressable
                                  key={c}
                                  onPress={() => setNote(c)}
                                  style={styles.quickChip}
                                >
                                  <Label
                                    style={{ color: P.primary, fontSize: 11 }}
                                  >
                                    {c}
                                  </Label>
                                </Pressable>
                              )
                            )}
                          </View>
                          <View style={styles.inlineActions}>
                            <Pressable
                              onPress={() => {
                                setRejectingId(null);
                                setNote('');
                              }}
                              style={styles.cancelBtn}
                            >
                              <Label style={{ color: P.muted }}>取消</Label>
                            </Pressable>
                            <Pressable
                              onPress={() => handleRejectTask(it)}
                              style={styles.rejectBtn}
                            >
                              <Label style={{ color: P.accentHot }}>
                                ↺ 再試一次
                              </Label>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.inlineActions}>
                          <Pressable
                            onPress={() => setRejectingId(it.instance.id)}
                            style={styles.rejectBtn}
                          >
                            <Label style={{ color: P.accentHot }}>
                              ↺ 再試一次
                            </Label>
                          </Pressable>
                          <Pressable
                            onPress={() => handleApproveTask(it)}
                            style={styles.approveBtn}
                          >
                            <RoughStar size={14} color={P.bg} glow={false} />
                            <Label
                              style={{
                                color: P.bg,
                                marginLeft: 6,
                              }}
                            >
                              通過 +★ {it.taskPoints}
                            </Label>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                </View>
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
      </SafeAreaView>
    </KeyboardAvoidingView>
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
    padding: spacing.md,
    backgroundColor: P.surfaceCream,
    borderRadius: radius.lg,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: `${P.primary}33`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCard: {
    padding: spacing.md,
    backgroundColor: P.surface,
    borderRadius: radius.lg,
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
    borderRadius: radius.md,
    backgroundColor: P.surfaceHi,
    overflow: 'hidden',
    position: 'relative',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  expandBody: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: P.border,
  },
  expandPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    backgroundColor: P.surfaceHi,
  },
  noteInput: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.bg,
    color: P.text,
    fontSize: 14,
    minHeight: 60,
  },
  quickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: `${P.primary}18`,
    borderWidth: 1,
    borderColor: P.border,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
  },
  approveBtn: {
    flex: 1.5,
    paddingVertical: 13,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.accentHot,
    alignItems: 'center',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
  },
});
