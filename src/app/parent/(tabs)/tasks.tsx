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
import type { Task, TaskInstance } from '../../../types/models';
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

const TASK_TEMPLATES = [
  { title: '整理書桌', points: 10 },
  { title: '刷牙', points: 5 },
  { title: '做功課', points: 15 },
  { title: '整理房間', points: 20 },
  { title: '洗碗', points: 10 },
  { title: '準備書包', points: 5 },
  { title: '摺衣服', points: 10 },
  { title: '倒垃圾', points: 5 },
];

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

const freqLabel = (f?: string): string => {
  switch (f) {
    case 'daily': return '每天';
    case 'weekly': return '每週';
    case 'monthly': return '每月';
    case 'once': return '單次';
    default: return '';
  }
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

type TaskWithInstances = { task: Task; instances: TaskInstance[] };

export default function ParentTasks() {
  const uid = auth().currentUser?.uid;
  const [tab, setTab] = useState<'manage' | 'history'>('manage');
  const [tasks, setTasks] = useState<TaskWithInstances[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filterChild, setFilterChild] = useState<string | null>(null);

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
      }, (err) => console.error('[ParentTasks] membership error:', (err as any)?.code));
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('tasks')
      .where('familyId', '==', familyId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const list: TaskWithInstances[] = [];
        for (const doc of snap.docs) {
          const task = { id: doc.id, ...doc.data() } as Task;
          const instSnap = await firestore()
            .collection('taskInstances')
            .where('taskId', '==', task.id)
            .where('familyId', '==', familyId)
            .get();
          const instances = instSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as TaskInstance)
          );
          list.push({ task, instances });
        }
        setTasks(list);
      }, (err) => console.error('[ParentTasks] tasks error:', (err as any)?.code));
    return unsub;
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('familyMemberships')
      .where('familyId', '==', familyId)
      .where('role', '==', 'child')
      .where('status', '==', 'active')
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const kids = await Promise.all(
          snap.docs.map(async (d) => {
            const userId = d.data().userId;
            const userDoc = await firestore()
              .collection('users')
              .doc(userId)
              .get();
            return {
              id: userId,
              name: userDoc.data()?.displayName || '小朋友',
            };
          })
        );
        setChildren(kids);
      }, (err) => console.error('[ParentTasks] children error:', (err as any)?.code));
    return unsub;
  }, [familyId]);

  const filteredTasks = useMemo(() => {
    if (!filterChild) return tasks;
    return tasks.filter((tw) =>
      tw.instances.some((i) => i.userId === filterChild)
    );
  }, [tasks, filterChild]);

  const activeCount = filteredTasks.length;

  const history = useMemo(() => {
    const all: {
      instance: TaskInstance;
      task: Task;
    }[] = [];
    for (const tw of tasks) {
      for (const inst of tw.instances) {
        if (inst.status === 'approved' || inst.status === 'rejected') {
          all.push({ instance: inst, task: tw.task });
        }
      }
    }
    return all.sort((a, b) => {
      const at = (a.instance.reviewedAt as any)?.toMillis?.() || 0;
      const bt = (b.instance.reviewedAt as any)?.toMillis?.() || 0;
      return bt - at;
    });
  }, [tasks]);

  const historyStats = useMemo(() => {
    const completed = history.filter((h) => h.instance.status === 'approved').length;
    const redo = history.filter((h) => h.instance.status === 'rejected').length;
    const pts = history
      .filter((h) => h.instance.status === 'approved')
      .reduce((s, h) => s + (h.instance.pointsAwarded || h.task.points), 0);
    return { completed, redo, pts };
  }, [history]);

  const handleArchiveTask = (taskId: string) => {
    Alert.alert('刪除任務', '確定要刪除這個任務嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          await firestore()
            .collection('tasks')
            .doc(taskId)
            .update({ status: 'archived' });
        },
      },
    ]);
  };

  const childNameFor = (userId: string) =>
    children.find((c) => c.id === userId)?.name || '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Starfield count={14} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Label color={P.muted}>任務</Label>
          <Display style={{ marginTop: 2 }}>
            {tab === 'manage' ? `${activeCount} 個任務在跑` : '過去 7 天'}
          </Display>

          <View style={styles.segment}>
            {(['manage', 'history'] as const).map((k) => {
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
                    {k === 'manage' ? '管理' : '歷程'}
                  </Label>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Filter pills (manage tab only) */}
        {tab === 'manage' && children.length > 0 && (
          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setFilterChild(null)}
              style={[styles.filterPill, !filterChild && styles.filterPillOn]}
            >
              <Label style={[styles.filterPillLabel, !filterChild && styles.filterPillLabelOn]}>
                全部 · {tasks.length}
              </Label>
            </Pressable>
            {children.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setFilterChild(filterChild === c.id ? null : c.id)}
                style={[styles.filterPill, filterChild === c.id && styles.filterPillOn]}
              >
                <Label style={[styles.filterPillLabel, filterChild === c.id && styles.filterPillLabelOn]}>
                  {c.name}
                </Label>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {tab === 'manage' ? (
            filteredTasks.length === 0 ? (
              <Empty emoji="✦" title="還沒有任務" body="點右下角 + 新增一個" />
            ) : (
              filteredTasks.map((tw) => {
                const approved = tw.instances.filter((i) => i.status === 'approved').length;
                const total = tw.instances.length;
                const pct = total ? approved / total : 0;
                return (
                  <Pressable
                    key={tw.task.id}
                    onLongPress={() => handleArchiveTask(tw.task.id)}
                    delayLongPress={800}
                    style={styles.taskCard}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <View style={styles.iconBox}>
                        <Body style={{ fontSize: 22 }}>{emojiFor(tw.task.title)}</Body>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.rowBetween}>
                          <H3 numberOfLines={1} style={{ fontSize: 15, flex: 1 }}>
                            {tw.task.title}
                          </H3>
                          <Data style={{ color: P.primary, fontSize: 13, fontWeight: '700' }}>
                            ★ {tw.task.points}
                          </Data>
                        </View>
                        <BodySm style={{ color: P.muted, marginTop: 2, fontSize: 11 }}>
                          {(() => {
                            const names = tw.instances
                              .map((i) => childNameFor(i.userId))
                              .filter(Boolean)
                              .filter((v, i, a) => a.indexOf(v) === i)
                              .join('、') || '未指派';
                            const freq = freqLabel(tw.task.frequency);
                            return freq ? `${names} · ${freq}` : names;
                          })()}
                        </BodySm>
                        <View style={styles.progressRow}>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${pct * 100}%` as any }]} />
                          </View>
                          <Data style={styles.progressText}>
                            {approved}/{total || 0}
                          </Data>
                        </View>
                        <View style={styles.instanceRow}>
                          {tw.instances.slice(0, 4).map((inst) => (
                            <InstanceDot key={inst.id} status={inst.status} />
                          ))}
                          {tw.instances.length > 4 && (
                            <Muted style={{ fontSize: 11 }}>
                              +{tw.instances.length - 4}
                            </Muted>
                          )}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleArchiveTask(tw.task.id)}
                        hitSlop={8}
                        style={styles.moreBtn}
                      >
                        <Label style={styles.moreLabel}>⋯</Label>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })
            )
          ) : (
            <>
              {/* History stats */}
              <View style={styles.historyStats}>
                <View style={styles.statCard}>
                  <Data style={{ color: P.green, fontSize: 22, fontWeight: '700' }}>
                    {historyStats.completed}
                  </Data>
                  <Label color={P.muted} style={{ fontSize: 10, marginTop: 2 }}>完成</Label>
                </View>
                <View style={styles.statCard}>
                  <Data style={{ color: P.primary, fontSize: 22, fontWeight: '700' }}>
                    ★ {historyStats.pts}
                  </Data>
                  <Label color={P.muted} style={{ fontSize: 10, marginTop: 2 }}>星光</Label>
                </View>
                <View style={styles.statCard}>
                  <Data style={{ color: P.accentHot, fontSize: 22, fontWeight: '700' }}>
                    {historyStats.redo}
                  </Data>
                  <Label color={P.muted} style={{ fontSize: 10, marginTop: 2 }}>需重做</Label>
                </View>
              </View>

              {history.length === 0 ? (
                <Empty
                  emoji="📜"
                  title="還沒有紀錄"
                  body="小孩做完任務、你審核之後會出現在這。"
                />
              ) : (
                history.map(({ instance, task }) => (
                  <View key={instance.id} style={styles.historyRow}>
                    <View
                      style={[
                        styles.historyIcon,
                        {
                          backgroundColor:
                            instance.status === 'approved'
                              ? `${P.green}22`
                              : `${P.accentHot}22`,
                        },
                      ]}
                    >
                      <Label
                        style={{
                          color:
                            instance.status === 'approved' ? P.green : P.accentHot,
                        }}
                      >
                        {instance.status === 'approved' ? '✓' : '✗'}
                      </Label>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <H3 style={{ fontSize: 14 }} numberOfLines={1}>
                        {task.title}
                      </H3>
                      <View style={styles.historyMetaRow}>
                        <View
                          style={[
                            styles.childDot,
                            { backgroundColor: childColorFor(instance.userId) },
                          ]}
                        />
                        <Muted style={{ fontSize: 11 }}>
                          {childNameFor(instance.userId)} · {fmtWhen(instance.reviewedAt)}
                        </Muted>
                      </View>
                    </View>
                    <Data
                      style={{
                        color: instance.status === 'approved' ? P.primary : P.muted,
                        fontSize: 15,
                        fontWeight: '700',
                      }}
                    >
                      ★ {task.points}
                    </Data>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      {tab === 'manage' && (
        <Pressable
          onPress={() => setShowCreate(true)}
          style={styles.fab}
          hitSlop={10}
        >
          <Body style={{ color: P.bg, fontSize: 26, fontWeight: '800' }}>+</Body>
        </Pressable>
      )}

      <CreateTaskModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        familyId={familyId}
        uid={uid}
        children={children}
      />
    </SafeAreaView>
  );
}

function InstanceDot({ status }: { status: TaskInstance['status'] }) {
  const color =
    status === 'approved'
      ? P.green
      : status === 'submitted'
      ? P.accent
      : status === 'rejected'
      ? P.accentHot
      : P.muted;
  return <View style={[styles.statusDot, { backgroundColor: color }]} />;
}

function CreateTaskModal({
  visible,
  onClose,
  familyId,
  uid,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  familyId: string | null;
  uid: string | undefined;
  children: { id: string; name: string }[];
}) {
  const [form, setForm] = useState({
    title: '',
    points: '10',
    selectedChildren: [] as string[],
    frequency: 'once' as 'once' | 'daily' | 'weekly' | 'monthly',
    reviewMode: 'semi_auto' as 'semi_auto' | 'manual',
    graceDays: '2',
    dueDays: '1',
  });

  const toggleChild = (id: string) =>
    setForm((s) => ({
      ...s,
      selectedChildren: s.selectedChildren.includes(id)
        ? s.selectedChildren.filter((c) => c !== id)
        : [...s.selectedChildren, id],
    }));

  const getPeriodEnd = (frequency: string, dueDays: string): Date => {
    const now = new Date();
    const days = parseInt(dueDays) || 1;
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly': {
        const next = new Date(now);
        next.setMonth(next.getMonth() + 1);
        return next;
      }
      default:
        return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }
  };

  const handleCreate = async () => {
    if (!familyId || !uid || !form.title.trim()) return;
    const assignees =
      form.selectedChildren.length > 0
        ? form.selectedChildren
        : children.length > 0
        ? [children[0].id]
        : [];
    if (assignees.length === 0) {
      Alert.alert('錯誤', '請先新增孩子到家庭');
      return;
    }
    try {
      const now = firestore.Timestamp.now();
      const periodEnd = getPeriodEnd(form.frequency, form.dueDays);
      const dueDate = firestore.Timestamp.fromDate(periodEnd);
      const graceDays = parseInt(form.graceDays) || 2;
      const gracePeriodEnd = firestore.Timestamp.fromDate(
        new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000)
      );
      const taskRef = await firestore().collection('tasks').add({
        familyId,
        title: form.title.trim(),
        points: parseInt(form.points) || 10,
        frequency: form.frequency,
        startDate: now,
        dueDate,
        graceDays,
        reviewMode: form.reviewMode,
        assigneeType: assignees.length > 1 ? 'family' : 'individual',
        assigneeUserId: assignees.length === 1 ? assignees[0] : null,
        status: 'active',
        createdBy: uid,
        createdAt: now,
      });
      for (const childId of assignees) {
        await firestore().collection('taskInstances').add({
          taskId: taskRef.id,
          userId: childId,
          familyId,
          periodStart: now,
          periodEnd: dueDate,
          gracePeriodEnd,
          status: 'pending',
          submissionCount: 0,
          reviewedBy: null,
          reviewedAt: null,
          pointsAwarded: null,
        });
      }
      setForm({
        title: '',
        points: '10',
        selectedChildren: [],
        frequency: 'once',
        reviewMode: 'semi_auto',
        graceDays: '2',
        dueDays: '1',
      });
      onClose();
    } catch (e: any) {
      Alert.alert('建立失敗', e?.message || '不明錯誤');
    }
  };

  const pickTemplate = (t: { title: string; points: number }) => {
    setForm((s) => ({ ...s, title: t.title, points: String(t.points) }));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.sheet}>
              <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
                <H3 style={{ fontSize: 18, marginBottom: spacing.md }}>
                  新增任務
                </H3>

                <Label color={P.muted} style={{ marginBottom: 6 }}>
                  快速範本
                </Label>
                <View style={modalStyles.templateRow}>
                  {TASK_TEMPLATES.map((t) => (
                    <Pressable
                      key={t.title}
                      onPress={() => pickTemplate(t)}
                      style={modalStyles.chip}
                    >
                      <Label style={{ color: P.primary, fontSize: 11 }}>
                        {t.title}
                      </Label>
                      <Muted style={{ fontSize: 10, marginLeft: 4 }}>
                        {t.points}
                      </Muted>
                    </Pressable>
                  ))}
                </View>

                <Label color={P.muted} style={{ marginTop: spacing.md }}>
                  任務名稱
                </Label>
                <TextInput
                  style={modalStyles.input}
                  placeholder="例：整理書桌"
                  placeholderTextColor={P.muted}
                  value={form.title}
                  onChangeText={(title) => setForm((s) => ({ ...s, title }))}
                />

                <Label color={P.muted} style={{ marginTop: spacing.md }}>
                  點數
                </Label>
                <TextInput
                  style={modalStyles.input}
                  placeholder="10"
                  placeholderTextColor={P.muted}
                  value={form.points}
                  onChangeText={(points) => setForm((s) => ({ ...s, points }))}
                  keyboardType="numeric"
                />

                <Label color={P.muted} style={{ marginTop: spacing.md }}>
                  頻率
                </Label>
                <View style={modalStyles.optRow}>
                  {(['once', 'daily', 'weekly', 'monthly'] as const).map(
                    (freq) => {
                      const on = form.frequency === freq;
                      const label =
                        freq === 'once'
                          ? '單次'
                          : freq === 'daily'
                          ? '每天'
                          : freq === 'weekly'
                          ? '每週'
                          : '每月';
                      return (
                        <Pressable
                          key={freq}
                          onPress={() =>
                            setForm((s) => ({ ...s, frequency: freq }))
                          }
                          style={[modalStyles.opt, on && modalStyles.optOn]}
                        >
                          <Label
                            style={{
                              color: on ? P.bg : P.text,
                              fontSize: 12,
                            }}
                          >
                            {label}
                          </Label>
                        </Pressable>
                      );
                    }
                  )}
                </View>

                {form.frequency === 'once' && (
                  <>
                    <Label color={P.muted} style={{ marginTop: spacing.md }}>
                      截止幾天後
                    </Label>
                    <View style={modalStyles.optRow}>
                      {['1', '2', '3', '7'].map((d) => {
                        const on = form.dueDays === d;
                        return (
                          <Pressable
                            key={d}
                            onPress={() =>
                              setForm((s) => ({ ...s, dueDays: d }))
                            }
                            style={[modalStyles.opt, on && modalStyles.optOn]}
                          >
                            <Label
                              style={{
                                color: on ? P.bg : P.text,
                                fontSize: 12,
                              }}
                            >
                              {d} 天
                            </Label>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                {children.length > 0 && (
                  <>
                    <Label color={P.muted} style={{ marginTop: spacing.md }}>
                      指派給
                    </Label>
                    <View style={modalStyles.optRow}>
                      {children.map((c) => {
                        const on = form.selectedChildren.includes(c.id);
                        return (
                          <Pressable
                            key={c.id}
                            onPress={() => toggleChild(c.id)}
                            style={[modalStyles.opt, on && modalStyles.optOn]}
                          >
                            <Label
                              style={{
                                color: on ? P.bg : P.text,
                                fontSize: 12,
                              }}
                            >
                              {c.name}
                            </Label>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                <Label color={P.muted} style={{ marginTop: spacing.md }}>
                  審核模式
                </Label>
                <View style={modalStyles.optRow}>
                  {(['semi_auto', 'manual'] as const).map((m) => {
                    const on = form.reviewMode === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setForm((s) => ({ ...s, reviewMode: m }))}
                        style={[modalStyles.opt, on && modalStyles.optOn]}
                      >
                        <Label
                          style={{
                            color: on ? P.bg : P.text,
                            fontSize: 12,
                          }}
                        >
                          {m === 'semi_auto' ? '半自動（AI 先看）' : '手動審核'}
                        </Label>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={modalStyles.footer}>
                  <Pressable
                    onPress={onClose}
                    style={modalStyles.cancelBtn}
                  >
                    <Label style={{ color: P.muted }}>取消</Label>
                  </Pressable>
                  <Pressable
                    onPress={handleCreate}
                    disabled={!form.title.trim()}
                    style={[
                      modalStyles.saveBtn,
                      !form.title.trim() && { opacity: 0.5 },
                    ]}
                  >
                    <Label style={{ color: P.bg }}>建立</Label>
                  </Pressable>
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
  scroll: { paddingBottom: 120 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
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
  taskCard: {
    padding: 14,
    backgroundColor: P.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${P.primary}2E`,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  moreLabel: {
    fontSize: 16,
    color: P.muted,
    fontWeight: '700',
  },
  historyMetaRow: {
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: 'transparent',
  },
  filterPillOn: {
    backgroundColor: P.primary,
    borderColor: P.primary,
  },
  filterPillLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: P.muted,
  },
  filterPillLabelOn: {
    color: P.bg,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: P.surfaceHi,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: P.green,
    borderRadius: radius.full,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: P.muted,
    minWidth: 32,
    textAlign: 'right',
  },
  historyStats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
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
  instanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: P.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 6,
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: P.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: P.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: `${P.primary}18`,
    borderWidth: 1,
    borderColor: P.border,
  },
  input: {
    marginTop: 6,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.bg,
    color: P.text,
    fontSize: 15,
  },
  optRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  opt: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.surfaceHi,
  },
  optOn: {
    backgroundColor: P.primary,
    borderColor: P.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
  },
});
