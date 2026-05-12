import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { TaskInstance, Task, PointWallet } from '../../../types/models';
import { useAuth } from '../../../hooks/useAuth';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import { Empty } from '../../../design/Empty';
import { Display, H3, BodySm, Label, Data } from '../../../design/Text';
import CelebrationOverlay from '../../../components/CelebrationOverlay';

type TaskWithInstance = {
  task: Task & { emoji?: string };
  instance: TaskInstance & { parentNote?: string | null; submittedAt?: any };
};

type Tone = 'todo' | 'pending' | 'done';

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

const fmtWhen = (ts: any): string => {
  if (!ts) return '剛剛';
  const d: Date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return d.toLocaleDateString();
};

export default function ChildTasks() {
  const uid = auth().currentUser?.uid;
  const { user } = useAuth();
  const router = useRouter();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [items, setItems] = useState<TaskWithInstance[]>([]);
  const [wallet, setWallet] = useState<PointWallet | null>(null);
  const [celebration, setCelebration] = useState<{ points: number } | null>(null);
  const prevStatuses = useRef<Record<string, string>>({});
  const snapshotGen = useRef(0);

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
      }, (err) => console.error('[ChildTasks] membership error:', (err as any)?.code));
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
        setWallet(
          snap.empty
            ? null
            : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as PointWallet)
        );
      }, (err) => console.error('[ChildTasks] wallet error:', (err as any)?.code));
    return unsub;
  }, [uid, familyId]);

  useEffect(() => {
    if (!uid || !familyId) return;
    const unsub = firestore()
      .collection('taskInstances')
      .where('userId', '==', uid)
      .where('familyId', '==', familyId)
      .where('status', 'in', ['pending', 'submitted', 'approved', 'rejected'])
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const gen = ++snapshotGen.current;
        const next: TaskWithInstance[] = [];
        for (const doc of snap.docs) {
          try {
            const instance = { id: doc.id, ...doc.data() } as TaskInstance & {
              parentNote?: string | null;
              submittedAt?: any;
            };
            const taskDoc = await firestore()
              .collection('tasks')
              .doc(instance.taskId)
              .get();
            const taskData = taskDoc.data();
            if (taskData) {
              next.push({
                task: { id: taskDoc.id, ...taskData } as Task & { emoji?: string },
                instance,
              });
            }
            const prev = prevStatuses.current[doc.id];
            if (prev && prev !== 'approved' && instance.status === 'approved') {
              setCelebration({ points: instance.pointsAwarded || 0 });
            }
            prevStatuses.current[doc.id] = instance.status;
          } catch (e) {
            console.warn('[ChildTasks] skipping instance', doc.id, (e as any)?.code);
          }
        }
        if (gen === snapshotGen.current) setItems(next);
      }, (err) => {
        console.error('[ChildTasks] snapshot error:', (err as any)?.code, err?.message);
      });
    return unsub;
  }, [uid, familyId]);

  const grouped = useMemo(() => {
    const todo = items.filter(
      (i) => i.instance.status === 'pending' || i.instance.status === 'rejected'
    );
    const inFlight = items.filter((i) => i.instance.status === 'submitted');
    const done = items.filter((i) => i.instance.status === 'approved');
    const total = items.length;
    const pct = total ? Math.round((done.length / total) * 100) : 0;
    return { todo, inFlight, done, total, pct };
  }, [items]);

  const openTask = (instanceId: string) => {
    router.push(`/child/task/${instanceId}` as any);
  };

  const kidName = user?.displayName || '你';
  const balance = wallet?.balance || 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Starfield count={22} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Label color={P.muted} style={{ letterSpacing: 1.5 }}>今天的任務</Label>
            <Display style={{ marginTop: 4 }}>
              嗨，<Text style={{ color: P.primary }}>{kidName}</Text>
            </Display>
          </View>
          <View style={styles.starPill}>
            <Data style={{ color: P.star, fontSize: 13 }}>★</Data>
            <Data style={{ color: P.primary, marginLeft: 4, fontSize: 14 }}>
              {balance}
            </Data>
          </View>
        </View>

        {/* Progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Label color={P.muted}>
              今天完成 {grouped.done.length}/{grouped.total}
            </Label>
            <Data style={{ color: P.primary, fontSize: 13 }}>{grouped.pct}%</Data>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${grouped.pct}%` as const }]}
            />
          </View>
        </View>

        {/* Sections */}
        {items.length === 0 ? (
          <Empty emoji="✦" title="今天沒有任務" body="休息一下，明天再來！" />
        ) : (
          <View style={styles.sections}>
            {grouped.todo.length > 0 && (
              <>
                <SectionHeader
                  dot={P.primary}
                  label="要做的"
                  count={String(grouped.todo.length)}
                />
                {grouped.todo.map((it) => (
                  <TaskCard
                    key={it.instance.id}
                    item={it}
                    tone="todo"
                    onPress={() => openTask(it.instance.id)}
                  />
                ))}
              </>
            )}
            {grouped.inFlight.length > 0 && (
              <>
                <SectionHeader
                  dot={P.accent}
                  label="等爸媽看"
                  count={String(grouped.inFlight.length)}
                />
                {grouped.inFlight.map((it) => (
                  <TaskCard
                    key={it.instance.id}
                    item={it}
                    tone="pending"
                    onPress={() => openTask(it.instance.id)}
                  />
                ))}
              </>
            )}
            {grouped.done.length > 0 && (
              <>
                <SectionHeader
                  dot={P.green}
                  label="完成了"
                  count={`${grouped.done.length}/${grouped.total}`}
                />
                {grouped.done.map((it) => (
                  <TaskCard
                    key={it.instance.id}
                    item={it}
                    tone="done"
                    onPress={() => openTask(it.instance.id)}
                  />
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {celebration && (
        <CelebrationOverlay
          points={celebration.points}
          onComplete={() => setCelebration(null)}
        />
      )}
    </SafeAreaView>
  );
}

function SectionHeader({
  dot,
  label,
  count,
}: {
  dot: string;
  label: string;
  count: string;
}) {
  return (
    <View style={secStyles.row}>
      <View style={[secStyles.dot, { backgroundColor: dot }]} />
      <H3 style={secStyles.label}>{label}</H3>
      <Data style={secStyles.count}>{count}</Data>
    </View>
  );
}

function TaskCard({
  item,
  tone,
  onPress,
}: {
  item: TaskWithInstance;
  tone: Tone;
  onPress: () => void;
}) {
  const rejected = item.instance.status === 'rejected';
  const parentNote = item.instance.parentNote;
  const emoji = item.task.emoji || emojiFor(item.task.title);
  const isDone = tone === 'done';

  const iconBg =
    isDone
      ? `${P.green}22`
      : tone === 'pending'
      ? `${P.accent}22`
      : `${P.primary}18`;

  let subtitle;
  if (rejected) {
    subtitle = (
      <BodySm style={{ color: P.accentHot, marginTop: 2, fontWeight: '700' }}>
        要再試一次{parentNote ? ` · ${parentNote}` : ''}
      </BodySm>
    );
  } else if (tone === 'pending') {
    subtitle = (
      <BodySm style={{ color: P.accent, marginTop: 2, fontWeight: '600' }}>
        ⏳ 星光傳送中 · {fmtWhen(item.instance.submittedAt)}
      </BodySm>
    );
  } else if (isDone) {
    subtitle = (
      <BodySm style={{ color: P.green, marginTop: 2, fontWeight: '600' }}>
        ✓ 拿到 ★{item.instance.pointsAwarded || item.task.points}
      </BodySm>
    );
  } else {
    subtitle = (
      <BodySm style={{ color: P.muted, marginTop: 2, fontWeight: '600' }}>
        ★ {item.task.points} · 今天
      </BodySm>
    );
  }

  return (
    <Pressable
      onPress={isDone ? undefined : onPress}
      disabled={isDone}
      style={({ pressed }) => [
        styles.card,
        isDone && { opacity: 0.55 },
        !isDone && pressed && { opacity: 0.85 },
      ]}
    >
      {rejected && <View style={styles.rejectedRail} />}
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <BodySm style={{ fontSize: 20 }}>{emoji}</BodySm>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <H3
          numberOfLines={1}
          style={{
            color: isDone ? P.muted : P.text,
            textDecorationLine: isDone ? 'line-through' : 'none',
            fontSize: 15,
          }}
        >
          {item.task.title}
        </H3>
        {subtitle}
      </View>
      {!isDone && (
        <View style={styles.arrowBtn}>
          <Data style={{ color: P.bg, fontSize: 14, fontWeight: '800' }}>→</Data>
        </View>
      )}
    </Pressable>
  );
}

const secStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    marginRight: 6,
    flexShrink: 0,
  },
  label: {
    flex: 1,
    letterSpacing: 1.2,
    fontSize: 13,
    fontWeight: '800',
  },
  count: {
    fontSize: 11,
    color: P.muted,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['3xl'] + spacing.lg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  starPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: `${P.primary}18`,
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  progressCard: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    backgroundColor: P.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: P.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: P.surfaceHi,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: P.primary,
    borderRadius: radius.full,
  },
  sections: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  card: {
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rejectedRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: P.accentHot,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    flexShrink: 0,
  },
});
