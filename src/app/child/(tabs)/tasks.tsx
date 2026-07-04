import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { TaskInstance, Task, PointWallet } from '../../../types/models';
import { useAuth } from '../../../hooks/useAuth';
import { childIdFor, walletDocId } from '../../../lib/childId';
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
  if (/作業|功課|寫|算|數學|考/.test(t)) return '📝';
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

const dayPhrase = (): string => {
  const d = new Date();
  const dow = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  const hr = d.getHours();
  const part = hr < 12 ? '早上' : hr < 18 ? '下午' : '晚上';
  return `星期${dow}${part}`;
};

export default function ChildTasks() {
  const uid = auth().currentUser?.uid;
  const { user } = useAuth();
  const router = useRouter();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [items, setItems] = useState<TaskWithInstance[]>([]);
  const [wallet, setWallet] = useState<PointWallet | null>(null);
  const [celebration, setCelebration] = useState<{ points: number } | null>(null);
  // B10：孩子提議任務
  const [showPropose, setShowPropose] = useState(false);
  const [proposeTitle, setProposeTitle] = useState('');
  const [proposePoints, setProposePoints] = useState('20');
  const [proposing, setProposing] = useState(false);
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

  const childId = childIdFor(user, uid ?? '');

  useEffect(() => {
    if (!uid || !familyId) return;
    const unsub = firestore()
      .collection('pointWallets')
      .doc(walletDocId(familyId, childId))
      .onSnapshot((doc) => {
        if (!doc) return;
        setWallet(
          doc.exists() ? ({ id: doc.id, ...doc.data() } as PointWallet) : null
        );
      }, (err) => console.error('[ChildTasks] wallet error:', (err as any)?.code));
    return unsub;
  }, [uid, familyId, childId]);

  useEffect(() => {
    if (!uid || !familyId) return;
    const unsub = firestore()
      .collection('taskInstances')
      .where('childId', '==', childId)
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
            // 家長刪除任務是 soft delete（status='archived'）。archived 的任務不該再出現在
            // 小孩清單、也不該能再提交——過濾掉，避免「刪了還看得到、還能交、還發點」。
            if (taskData && taskData.status !== 'archived') {
              next.push({
                task: { id: taskDoc.id, ...taskData } as Task & { emoji?: string },
                instance,
              });
            }
            // 慶祝動畫：只在「核准且 CF 已把 pointsAwarded 寫入」時觸發，否則會閃「+0」
            // （狀態先翻 approved、pointsAwarded 由 trigger 稍後才補）。
            const prev = prevStatuses.current[doc.id];
            const approvedWithPoints =
              instance.status === 'approved' && instance.pointsAwarded != null;
            if (prev && prev !== 'approved' && approvedWithPoints) {
              setCelebration({ points: instance.pointsAwarded as number });
            }
            // pointsAwarded 未到位前不把 prev 推進成 approved，確保下次補到時仍算「轉換」。
            if (approvedWithPoints) prevStatuses.current[doc.id] = 'approved';
            else if (instance.status !== 'approved')
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
  }, [uid, familyId, childId]);

  const grouped = useMemo(() => {
    const daily: TaskWithInstance[] = [];
    const weekly: TaskWithInstance[] = [];
    const other: TaskWithInstance[] = [];
    for (const it of items) {
      const f = it.task.frequency;
      if (f === 'daily') daily.push(it);
      else if (f === 'weekly') weekly.push(it);
      else other.push(it);
    }
    const count = (arr: TaskWithInstance[]) => ({
      done: arr.filter((i) => i.instance.status === 'approved').length,
      total: arr.length,
    });
    const total = items.length;
    const doneAll = items.filter((i) => i.instance.status === 'approved').length;
    const pendingAll = items.filter(
      (i) => i.instance.status === 'pending' || i.instance.status === 'rejected'
    ).length;
    return {
      daily,
      dailyC: count(daily),
      weekly,
      weeklyC: count(weekly),
      other,
      otherC: count(other),
      total,
      done: doneAll,
      pending: pendingAll,
      pct: total ? Math.round((doneAll / total) * 100) : 0,
    };
  }, [items]);

  const openTask = (instanceId: string) => {
    router.push(`/child/task/${instanceId}` as any);
  };

  const kidName = user?.displayName || '你';
  const balance = wallet?.balance || 0;

  const submitProposal = async () => {
    if (!uid || !familyId || !proposeTitle.trim() || proposing) return;
    setProposing(true);
    try {
      await firestore().collection('tasks').add({
        familyId,
        title: proposeTitle.trim(),
        points: Math.max(1, parseInt(proposePoints) || 20),
        frequency: 'once',
        status: 'proposed', // 家長核准後才變 active（rules 只放行小孩建 proposed）
        createdBy: uid,
        assigneeType: 'individual',
        assigneeUserId: uid,
        reviewMode: 'manual',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      setShowPropose(false);
      setProposeTitle('');
      setProposePoints('20');
      Alert.alert('已送出 ✦', '等爸媽同意，同意後就會出現在你的任務裡。');
    } catch (e: any) {
      Alert.alert('送出失敗', e?.message || '再試一次');
    } finally {
      setProposing(false);
    }
  };

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
            <Label color={P.muted} style={{ letterSpacing: 1.5, fontSize: 11 }}>
              {dayPhrase()}
            </Label>
            <Display style={{ marginTop: 6 }}>
              嗨 <Text style={{ color: P.primary }}>{kidName}</Text>,
            </Display>
            <Display style={{ marginTop: -2 }}>今天的任務</Display>
          </View>
          <View style={styles.starPill}>
            <Data style={{ color: P.bg, fontSize: 13 }}>★</Data>
            <Data style={{ color: P.bg, marginLeft: 4, fontSize: 14, fontWeight: '800' }}>
              {balance}
            </Data>
          </View>
        </View>

        {/* Progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Label color={P.text} style={{ fontSize: 13 }}>
              {grouped.pending > 0
                ? `${grouped.pending} 個等你，收集星光`
                : grouped.total > 0
                ? '今天的任務都完成了'
                : '今天沒有任務'}
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
            {grouped.daily.length > 0 && (
              <FrequencySection
                label="每日"
                hint="今晚結束"
                items={grouped.daily}
                counts={grouped.dailyC}
                onOpen={openTask}
              />
            )}
            {grouped.weekly.length > 0 && (
              <FrequencySection
                label="每週"
                hint="這週任一天"
                items={grouped.weekly}
                counts={grouped.weeklyC}
                onOpen={openTask}
              />
            )}
            {grouped.other.length > 0 && (
              <FrequencySection
                label="其他"
                hint="特別任務"
                items={grouped.other}
                counts={grouped.otherC}
                onOpen={openTask}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* B10：提議任務入口 */}
      <Pressable
        onPress={() => setShowPropose(true)}
        style={styles.proposeFab}
        hitSlop={10}
      >
        <Text style={{ fontSize: 20 }}>✎</Text>
        <Label style={{ color: P.bg, fontSize: 12, marginLeft: 6, fontWeight: '800' }}>
          提議任務
        </Label>
      </Pressable>

      <Modal visible={showPropose} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.proposeOverlay}>
            <View style={styles.proposeSheet}>
              <H3 style={{ marginBottom: 4 }}>想做什麼任務？</H3>
              <BodySm color={P.muted} style={{ marginBottom: spacing.md }}>
                告訴爸媽你想做的任務，他們同意後就能開始賺星光。
              </BodySm>
              <TextInput
                style={styles.proposeInput}
                placeholder="任務名稱（例如：幫忙洗碗）"
                placeholderTextColor={P.muted}
                value={proposeTitle}
                onChangeText={setProposeTitle}
              />
              <TextInput
                style={styles.proposeInput}
                placeholder="想要幾顆星（爸媽可調整）"
                placeholderTextColor={P.muted}
                value={proposePoints}
                onChangeText={(t) => setProposePoints(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
                <Pressable
                  onPress={() => setShowPropose(false)}
                  style={styles.proposeCancel}
                >
                  <Label style={{ color: P.muted }}>取消</Label>
                </Pressable>
                <Pressable
                  onPress={submitProposal}
                  disabled={!proposeTitle.trim() || proposing}
                  style={[
                    styles.proposeSubmit,
                    (!proposeTitle.trim() || proposing) && { opacity: 0.5 },
                  ]}
                >
                  <Label style={{ color: P.bg, fontWeight: '800' }}>
                    {proposing ? '送出中…' : '送給爸媽'}
                  </Label>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  hint,
}: {
  dot: string;
  label: string;
  count: string;
  hint?: string;
}) {
  return (
    <View style={secStyles.row}>
      <View style={[secStyles.dot, { backgroundColor: dot }]} />
      <H3 style={secStyles.label}>{label}</H3>
      <Data style={secStyles.count}>{count}</Data>
      {hint && (
        <BodySm style={{ color: P.muted, marginLeft: 8, fontSize: 11 }}>
          {hint}
        </BodySm>
      )}
    </View>
  );
}

function FrequencySection({
  label,
  hint,
  items,
  counts,
  onOpen,
}: {
  label: string;
  hint: string;
  items: TaskWithInstance[];
  counts: { done: number; total: number };
  onOpen: (instanceId: string) => void;
}) {
  const toneFor = (it: TaskWithInstance): Tone => {
    const st = it.instance.status;
    if (st === 'approved') return 'done';
    if (st === 'submitted') return 'pending';
    return 'todo';
  };
  return (
    <>
      <SectionHeader
        dot={P.primary}
        label={label}
        count={`${counts.done}/${counts.total}`}
        hint={hint}
      />
      {items.map((it) => (
        <TaskCard
          key={it.instance.id}
          item={it}
          tone={toneFor(it)}
          onPress={() => onOpen(it.instance.id)}
        />
      ))}
    </>
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
      onPress={isDone && !__DEV__ ? undefined : onPress}
      disabled={isDone && !__DEV__}
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
    backgroundColor: P.primary,
    borderWidth: 0,
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
  proposeFab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.full,
    shadowColor: P.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  proposeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  proposeSheet: {
    backgroundColor: P.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: P.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  proposeInput: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.bg,
    color: P.text,
    fontSize: 15,
    marginBottom: 12,
  },
  proposeCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
  },
  proposeSubmit: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
  },
});
