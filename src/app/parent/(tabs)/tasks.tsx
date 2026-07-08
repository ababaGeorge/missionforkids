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
import { memberName } from '../../../lib/memberName';
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
  const [taskDocs, setTaskDocs] = useState<Task[]>([]);
  // 全家庭 taskInstances 即時訂閱，依 taskId 分組；tasks 由此 join 而成，不再是一次性快照。
  const [instByTask, setInstByTask] = useState<Record<string, TaskInstance[]>>({});
  const tasks = useMemo<TaskWithInstances[]>(
    () => taskDocs.map((task) => ({ task, instances: instByTask[task.id] ?? [] })),
    [taskDocs, instByTask]
  );
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<{ id: string; name: string; childId: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithInstances | null>(null);
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
      .onSnapshot((snap) => {
        if (!snap) return;
        setTaskDocs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Task)));
      }, (err) => console.error('[ParentTasks] tasks error:', (err as any)?.code));
    return unsub;
  }, [familyId]);

  // 全家庭 taskInstances 即時訂閱：建立指派、小孩提交、家長核准都會即時反映在卡片與編輯 modal，
  // 不再依賴 tasks 變動才重抓（原本的一次性 get() 導致新指派要重登才顯示、編輯 modal 讀到空陣列、
  // 編輯儲存的去重表用到 stale 資料而重複建立 instance）。
  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('taskInstances')
      .where('familyId', '==', familyId)
      .onSnapshot((snap) => {
        if (!snap) return;
        const grouped: Record<string, TaskInstance[]> = {};
        for (const d of snap.docs) {
          const inst = { id: d.id, ...d.data() } as TaskInstance;
          (grouped[inst.taskId] ??= []).push(inst);
        }
        setInstByTask(grouped);
      }, (err) => console.error('[ParentTasks] instances error:', (err as any)?.code));
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
            const membership = d.data();
            const userId = membership.userId;
            const userDoc = await firestore()
              .collection('users')
              .doc(userId)
              .get();
            return {
              id: userId,
              name: memberName(membership as any, userDoc.data() as any, '小朋友'),
              childId: membership.childId ?? userId,
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
                    onPress={() => { setEditingTask(tw); setShowCreate(true); }}
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
        onClose={() => { setShowCreate(false); setEditingTask(null); }}
        familyId={familyId}
        uid={uid}
        children={children}
        editing={editingTask}
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
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  familyId: string | null;
  uid: string | undefined;
  children: { id: string; name: string; childId: string }[];
  editing?: TaskWithInstances | null;
}) {
  // assignee userId → 永久 childId（點數釘 childId）；找不到退回 userId
  const childIdOf = (assigneeUserId: string) =>
    children.find((c) => c.id === assigneeUserId)?.childId ?? assigneeUserId;
  const [saving, setSaving] = useState(false); // 防連點：多筆網路寫入期間鎖住送出
  const [form, setForm] = useState({
    title: '',
    points: '10',
    selectedChildren: [] as string[],
    frequency: 'once' as 'once' | 'daily' | 'weekly' | 'monthly',
    reviewMode: 'semi_auto' as 'semi_auto' | 'manual',
    graceDays: '2',
    dueDays: '1', // once: 1-365 自由填
    weekday: '1', // weekly: 1=一 ... 7=日
    monthDay: '1', // monthly: '1'|'5'|'10'|'15'|'20'|'25'|'eom'
  });

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      const t = editing.task;
      const due: Date =
        typeof (t.dueDate as any)?.toDate === 'function'
          ? (t.dueDate as any).toDate()
          : new Date();
      // 從現有 dueDate 反推選擇器值（近似還原）
      let weekday = '1';
      let monthDay = '1';
      let dueDays = '1';
      if (t.frequency === 'weekly') {
        const js = due.getDay(); // 0=日..6=六
        weekday = js === 0 ? '7' : String(js);
      } else if (t.frequency === 'monthly') {
        const lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
        const dd = due.getDate();
        if (dd === lastDay) monthDay = 'eom';
        else if ([1, 5, 10, 15, 20, 25].includes(dd)) monthDay = String(dd);
        else monthDay = '1';
      } else if (t.frequency === 'once') {
        const created: Date =
          typeof (t.createdAt as any)?.toDate === 'function'
            ? (t.createdAt as any).toDate()
            : new Date();
        const d = Math.round((due.getTime() - created.getTime()) / 86400000);
        dueDays = String(Math.min(365, Math.max(1, d || 1)));
      }
      setForm({
        title: t.title,
        points: String(t.points),
        // editing.instances 現在來自即時的 instByTask 訂閱（見上方 tasks useMemo），
        // 不再是開卡片當下的一次性快照 —— 指派給才會正確預填。
        selectedChildren: editing.instances
          .map((i) => i.userId)
          .filter((v, i, a) => a.indexOf(v) === i),
        frequency: t.frequency,
        reviewMode: t.reviewMode,
        graceDays: String(t.graceDays ?? 2),
        dueDays,
        weekday,
        monthDay,
      });
    } else {
      setForm({
        title: '',
        points: '10',
        selectedChildren: [],
        frequency: 'once',
        reviewMode: 'semi_auto',
        graceDays: '2',
        dueDays: '1',
        weekday: '1',
        monthDay: '1',
      });
    }
  }, [visible, editing]);

  const toggleChild = (id: string) =>
    setForm((s) => ({
      ...s,
      selectedChildren: s.selectedChildren.includes(id)
        ? s.selectedChildren.filter((c) => c !== id)
        : [...s.selectedChildren, id],
    }));

  // Plan C：每天=當天底；每週=下一個指定週幾；每月=指定號數(或月底，自動處理2月大小月)；單次=N天後
  const getPeriodEnd = (): Date => {
    const now = new Date();
    switch (form.frequency) {
      case 'daily': {
        const d = new Date(now);
        d.setHours(23, 59, 59, 0);
        return d;
      }
      case 'weekly': {
        const target = parseInt(form.weekday) || 1; // 1=一..7=日
        const jsTarget = target === 7 ? 0 : target; // JS getDay: 0=日..6=六
        const d = new Date(now);
        let diff = (jsTarget - d.getDay() + 7) % 7;
        if (diff === 0) diff = 7; // 今天就是該週幾 → 推到下週，避免「立刻到期」
        d.setDate(d.getDate() + diff);
        d.setHours(23, 59, 59, 0);
        return d;
      }
      case 'monthly': {
        const y = now.getFullYear();
        const m = now.getMonth();
        if (form.monthDay === 'eom') {
          // 當月最後一天；若今天已是最後一天，推到下個月底
          let last = new Date(y, m + 1, 0, 23, 59, 59);
          if (now.getDate() === last.getDate()) {
            last = new Date(y, m + 2, 0, 23, 59, 59);
          }
          return last;
        }
        const day = parseInt(form.monthDay) || 1; // 1/5/10/15/20/25（皆<=28，無2月問題）
        let candidate = new Date(y, m, day, 23, 59, 59);
        if (candidate.getTime() <= now.getTime()) {
          candidate = new Date(y, m + 1, day, 23, 59, 59);
        }
        return candidate;
      }
      default: {
        // once: 1-365 天後
        const days = Math.min(365, Math.max(1, parseInt(form.dueDays) || 1));
        return new Date(now.getTime() + days * 86400000);
      }
    }
  };

  const handleCreate = async () => {
    if (!familyId || !uid || !form.title.trim()) return;
    if (saving) return; // 防連點：避免重複建立任務與重複 instances
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
    setSaving(true);
    try {
      const now = firestore.Timestamp.now();
      const periodEnd = getPeriodEnd();
      const dueDate = firestore.Timestamp.fromDate(periodEnd);
      const graceDays = parseInt(form.graceDays) || 2;
      const gracePeriodEnd = firestore.Timestamp.fromDate(
        new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000)
      );

      if (editing) {
        // 編輯模式：更新 task 欄位 + 對帳 instances（加/移除指派的孩子）
        await firestore().collection('tasks').doc(editing.task.id).update({
          title: form.title.trim(),
          points: parseInt(form.points) || 10,
          frequency: form.frequency,
          dueDate,
          graceDays,
          reviewMode: form.reviewMode,
          assigneeType: assignees.length > 1 ? 'family' : 'individual',
          assigneeUserId: assignees.length === 1 ? assignees[0] : null,
        });
        // 去重表同樣吃即時的 editing.instances（來自 instByTask），
        // 不會把既有指派誤判為新指派而重複 add() 一份 instance。
        const existingByUser = new Map(
          editing.instances.map((i) => [i.userId, i])
        );
        // 新增的孩子 → 建新 pending instance
        for (const childId of assignees) {
          if (!existingByUser.has(childId)) {
            await firestore().collection('taskInstances').add({
              taskId: editing.task.id,
              userId: childId,
              childId: childIdOf(childId),
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
        }
        // 被移除的孩子 → instance 標 missed（保留歷史，不刪）
        for (const inst of editing.instances) {
          if (!assignees.includes(inst.userId) && inst.status !== 'missed') {
            await firestore()
              .collection('taskInstances')
              .doc(inst.id)
              .update({ status: 'missed' });
          }
        }
        onClose();
        return;
      }

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
          childId: childIdOf(childId),
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
        weekday: '1',
        monthDay: '1',
      });
      onClose();
    } catch (e: any) {
      Alert.alert(editing ? '儲存失敗' : '建立失敗', e?.message || '不明錯誤');
    } finally {
      setSaving(false);
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
                  {editing ? '編輯任務' : '新增任務'}
                </H3>

                {!editing && (
                  <>
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
                  </>
                )}

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
                      幾天後截止（1-365）
                    </Label>
                    <TextInput
                      style={modalStyles.input}
                      placeholder="例：7"
                      placeholderTextColor={P.muted}
                      value={form.dueDays}
                      onChangeText={(v) => {
                        const n = v.replace(/[^0-9]/g, '');
                        setForm((s) => ({ ...s, dueDays: n }));
                      }}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                  </>
                )}

                {form.frequency === 'daily' && (
                  <Muted style={{ marginTop: spacing.md, fontSize: 12 }}>
                    每天截止於當天結束
                  </Muted>
                )}

                {form.frequency === 'weekly' && (
                  <>
                    <Label color={P.muted} style={{ marginTop: spacing.md }}>
                      每週幾截止
                    </Label>
                    <View style={modalStyles.optRow}>
                      {[
                        { v: '1', l: '一' },
                        { v: '2', l: '二' },
                        { v: '3', l: '三' },
                        { v: '4', l: '四' },
                        { v: '5', l: '五' },
                        { v: '6', l: '六' },
                        { v: '7', l: '日' },
                      ].map((d) => {
                        const on = form.weekday === d.v;
                        return (
                          <Pressable
                            key={d.v}
                            onPress={() => setForm((s) => ({ ...s, weekday: d.v }))}
                            style={[modalStyles.opt, on && modalStyles.optOn]}
                          >
                            <Label style={{ color: on ? P.bg : P.text, fontSize: 12 }}>
                              {d.l}
                            </Label>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                {form.frequency === 'monthly' && (
                  <>
                    <Label color={P.muted} style={{ marginTop: spacing.md }}>
                      每月幾號截止
                    </Label>
                    <View style={modalStyles.optRow}>
                      {[
                        { v: '1', l: '1號' },
                        { v: '5', l: '5號' },
                        { v: '10', l: '10號' },
                        { v: '15', l: '15號' },
                        { v: '20', l: '20號' },
                        { v: '25', l: '25號' },
                        { v: 'eom', l: '月底' },
                      ].map((d) => {
                        const on = form.monthDay === d.v;
                        return (
                          <Pressable
                            key={d.v}
                            onPress={() => setForm((s) => ({ ...s, monthDay: d.v }))}
                            style={[modalStyles.opt, on && modalStyles.optOn]}
                          >
                            <Label style={{ color: on ? P.bg : P.text, fontSize: 12 }}>
                              {d.l}
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
                    disabled={!form.title.trim() || saving}
                    style={[
                      modalStyles.saveBtn,
                      (!form.title.trim() || saving) && { opacity: 0.5 },
                    ]}
                  >
                    <Label style={{ color: P.bg }}>
                      {saving ? '處理中…' : editing ? '儲存' : '建立'}
                    </Label>
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
