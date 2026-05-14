import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { Task, TaskInstance } from '../../../types/models';
import { pickPhoto, uploadPhoto } from '../../../lib/photoUpload';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import { RoughStar } from '../../../design/RoughStar';
import { Display, H2, H3, Body, BodySm, Label, Muted, Data } from '../../../design/Text';

type InstanceDoc = TaskInstance & { parentNote?: string | null; submittedAt?: any };

const MAX_SUBMISSIONS = 3;

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

export default function ChildTaskDetail() {
  const { id: instanceId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const uid = auth().currentUser?.uid;

  const [instance, setInstance] = useState<InstanceDoc | null>(null);
  const [task, setTask] = useState<(Task & { emoji?: string }) | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Subscribe to instance
  useEffect(() => {
    if (!instanceId) return;
    const unsub = firestore()
      .collection('taskInstances')
      .doc(instanceId)
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const data = snap.data();
        if (!data) {
          setNotFound(true);
          return;
        }
        const inst = { id: snap.id, ...data } as InstanceDoc;
        setInstance(inst);
        if (!task || task.id !== inst.taskId) {
          const taskDoc = await firestore()
            .collection('tasks')
            .doc(inst.taskId)
            .get();
          const tData = taskDoc.data();
          if (tData) {
            setTask({ id: taskDoc.id, ...tData } as Task & { emoji?: string });
          }
        }
      });
    return unsub;
  }, [instanceId]);

  const onClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/child/(tabs)/tasks');
  };

  const handleTakePhoto = async () => {
    try {
      const uri = await pickPhoto();
      if (uri) setPhotoUri(uri);
    } catch (error: any) {
      if (error?.message === 'CAMERA_PERMISSION_DENIED') {
        Alert.alert('請允許使用相機', '我們需要相機權限才能拍照。');
      } else {
        Alert.alert('拍照失敗', '再試一次看看？');
      }
    }
  };

  const handleSubmit = async () => {
    if (!instance || !task || !uid || !photoUri) return;
    if ((instance.submissionCount || 0) >= MAX_SUBMISSIONS) {
      Alert.alert('已達提交上限', '這個任務今天不能再提交了。');
      return;
    }
    try {
      setSubmitting(true);
      const photoUrl = await uploadPhoto(instance.familyId, photoUri);
      await firestore().collection('taskSubmissions').add({
        taskInstanceId: instance.id,
        familyId: instance.familyId,
        submittedBy: uid,
        photoUrls: [photoUrl],
        childNote: note.trim() || null,
        aiResult: null,
        aiConfidence: null,
        submittedAt: firestore.FieldValue.serverTimestamp(),
      });
      await firestore()
        .collection('taskInstances')
        .doc(instance.id)
        .update({
          status: 'submitted',
          submissionCount: (instance.submissionCount || 0) + 1,
          submittedAt: firestore.FieldValue.serverTimestamp(),
        });
      setPhotoUri(null);
      setNote('');
    } catch (e) {
      Alert.alert('上傳失敗', '檢查一下網路，再試一次。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!instance) return;
    try {
      await firestore()
        .collection('taskInstances')
        .doc(instance.id)
        .update({ status: 'pending' });
      setPhotoUri(null);
    } catch {
      Alert.alert('再試一次失敗', '檢查網路再來。');
    }
  };

  if (notFound) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <Muted>找不到這個任務</Muted>
          <Pressable onPress={onClose} style={styles.closePill}>
            <Body>回上一頁</Body>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!instance || !task) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={P.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const emoji = task.emoji || emojiFor(task.title);
  const status = instance.status;
  const canSubmit =
    (status === 'pending' || status === 'rejected') &&
    (instance.submissionCount || 0) < MAX_SUBMISSIONS;

  if (status === 'approved') {
    return (
      <Celebrate
        task={task}
        pointsAwarded={instance.pointsAwarded || task.points}
        onClose={onClose}
      />
    );
  }

  if (status === 'submitted') {
    return (
      <Wait
        task={task}
        emoji={emoji}
        submittedAt={instance.submittedAt}
        onClose={onClose}
      />
    );
  }

  // pending or rejected → form
  const freqLabel =
    task.frequency === 'daily'
      ? '每日任務'
      : task.frequency === 'weekly'
      ? '每週任務'
      : '任務';
  const maxedOut = (instance.submissionCount || 0) >= MAX_SUBMISSIONS;
  const primaryAction = photoUri ? handleSubmit : handleTakePhoto;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Starfield count={20} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
      {/* Push nav header */}
      <View style={styles.navHeader}>
        <Pressable onPress={onClose} style={styles.backBtn} hitSlop={10}>
          <Body style={{ color: P.text, fontSize: 26, lineHeight: 26 }}>‹</Body>
        </Pressable>
        <Label color={P.muted} style={{ letterSpacing: 1.5, fontSize: 11 }}>
          {freqLabel}
        </Label>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Big illustration card */}
        <View style={styles.illustrationCard}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.illustrationPhoto} />
          ) : (
            <>
              <Text style={{ fontSize: 88, lineHeight: 100 }}>{emoji}</Text>
              <View style={[styles.starDeco, { top: 18, right: 24 }]}>
                <Text style={{ fontSize: 18, color: P.primary }}>★</Text>
              </View>
              <View style={[styles.starDeco, { bottom: 22, left: 22 }]}>
                <Text style={{ fontSize: 13, color: P.primary }}>★</Text>
              </View>
            </>
          )}
        </View>

        {/* Title */}
        <H2 style={{ marginTop: spacing.lg }}>{task.title}</H2>

        {/* Chips */}
        <View style={styles.chipRow}>
          <View style={styles.chipGold}>
            <Label style={{ color: P.bg, fontSize: 12, fontWeight: '800' }}>
              ★ {task.points} 星光
            </Label>
          </View>
          <View style={styles.chipDark}>
            <Label style={{ color: P.muted, fontSize: 12 }}>今天</Label>
          </View>
        </View>

        {/* Parent hint card */}
        {task.parentHint ? (
          <View style={styles.hintCard}>
            <Body style={{ fontSize: 18, marginRight: 10 }}>🦉</Body>
            <View style={{ flex: 1 }}>
              <Label color={P.muted} style={{ fontSize: 10, letterSpacing: 1 }}>
                媽媽的暗號
              </Label>
              <Body style={{ fontStyle: 'italic', marginTop: 2, color: P.text }}>
                {`"${task.parentHint}"`}
              </Body>
            </View>
          </View>
        ) : null}

        {status === 'rejected' && (
          <View style={styles.rejectedBox}>
            <Label style={{ color: P.accentHot }}>爸媽說要再試一次</Label>
            <Body style={{ marginTop: 6, lineHeight: 22 }}>
              {instance.parentNote || '可以再做一次喔！'}
            </Body>
          </View>
        )}

        {maxedOut && (
          <View style={styles.maxBox}>
            <Body>今天已經試 {MAX_SUBMISSIONS} 次了，明天再來吧。</Body>
          </View>
        )}

        {photoUri && !maxedOut && (
          <Pressable onPress={handleTakePhoto} style={styles.retakeRow}>
            <Label style={{ color: P.muted, fontSize: 12 }}>點一下重拍</Label>
          </Pressable>
        )}

        {/* Optional note */}
        <View style={styles.noteCard}>
          <Label color={P.muted} style={{ fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>
            想跟爸媽說什麼（選填）
          </Label>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="說明一下你做了什麼..."
            placeholderTextColor={P.muted}
            multiline
            style={styles.noteInput}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer: single gold CTA */}
      {!maxedOut && (
        <View style={styles.footerBar}>
          <Pressable
            onPress={primaryAction}
            disabled={submitting || (photoUri && !canSubmit) || false}
            style={styles.primaryCTA}
          >
            {submitting ? (
              <ActivityIndicator color={P.bg} />
            ) : photoUri ? (
              <>
                <RoughStar size={16} color={P.bg} glow={false} />
                <Label style={{ color: P.bg, fontSize: 16, marginLeft: 8, fontWeight: '800' }}>
                  完成任務
                </Label>
              </>
            ) : (
              <>
                <Body style={{ fontSize: 18 }}>📷</Body>
                <Label style={{ color: P.bg, fontSize: 16, marginLeft: 8, fontWeight: '800' }}>
                  拍一張照片
                </Label>
              </>
            )}
          </Pressable>
        </View>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Wait({
  task,
  emoji,
  submittedAt,
  onClose,
}: {
  task: Task & { emoji?: string };
  emoji: string;
  submittedAt: any;
  onClose: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Starfield count={40} />
      <View style={styles.sheetHeader}>
        <View style={styles.sheetHandle} />
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
          <Body style={{ color: P.muted }}>✕</Body>
        </Pressable>
      </View>
      <View style={styles.waitBody}>
        <Body style={{ fontSize: 72, marginBottom: 12 }}>✨</Body>
        <Display style={{ textAlign: 'center' }}>星光傳送中…</Display>
        <Muted style={{ marginTop: 8, textAlign: 'center', maxWidth: 280 }}>
          等爸媽看一眼就好 · {fmtWhen(submittedAt)}
        </Muted>

        <View style={styles.waitCard}>
          <View style={styles.waitIcon}>
            <Body style={{ fontSize: 26 }}>{emoji}</Body>
          </View>
          <View style={{ flex: 1 }}>
            <H3>{task.title}</H3>
            <Muted style={{ marginTop: 2, fontSize: 12 }}>
              提交 {fmtWhen(submittedAt)}
            </Muted>
          </View>
          <RoughStar size={16} />
          <Data style={{ color: P.primary, marginLeft: 6, fontWeight: '700' }}>
            {task.points}
          </Data>
        </View>
      </View>
      <View style={styles.footerBar}>
        <Pressable onPress={onClose} style={[styles.primaryBtn, styles.waitBack]}>
          <Label style={{ color: P.text }}>回到任務</Label>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Celebrate({
  task,
  pointsAwarded,
  onClose,
}: {
  task: Task & { emoji?: string };
  pointsAwarded: number;
  onClose: () => void;
}) {
  const router = useRouter();

  const goRewards = () => {
    router.replace('/child/(tabs)/rewards' as any);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: P.bg }]} edges={['top', 'bottom']}>
      <Starfield count={70} />
      <View style={styles.celebGlow} pointerEvents="none" />
      <View style={styles.celebBody}>
        <Body style={{ fontSize: 88 }}>🎉</Body>
        <Display style={{ fontSize: 32, marginTop: spacing.md, textAlign: 'center' }}>
          做得好！
        </Display>
        <Muted style={{ marginTop: spacing.sm, fontSize: 15 }}>{task.title}</Muted>
        <View style={styles.celebPill}>
          <RoughStar size={22} />
          <Data
            style={{
              color: P.primary,
              fontSize: 22,
              marginLeft: spacing.sm,
              fontWeight: '700',
            }}
          >
            +{pointsAwarded}
          </Data>
        </View>
      </View>
      <View style={styles.footerBar}>
        <Pressable onPress={goRewards} style={styles.secondaryBtn}>
          <Label style={{ color: P.muted }}>看獎勵</Label>
        </Pressable>
        <Pressable onPress={onClose} style={[styles.primaryBtn, { flex: 1 }]}>
          <RoughStar size={16} color={P.bg} glow={false} />
          <Label style={{ color: P.bg, fontSize: 15, marginLeft: 8 }}>
            下一個任務
          </Label>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  closePill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
  },
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  iconBoxLarge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: `${P.primary}18`,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectedBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: `${P.accentHot}18`,
    borderWidth: 1,
    borderColor: `${P.accentHot}33`,
  },
  maxBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
  },
  photoCard: {
    marginTop: spacing.md,
    aspectRatio: 4 / 3,
    borderRadius: radius.xl,
    backgroundColor: P.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: { ...StyleSheet.absoluteFillObject },
  retakeChip: {
    position: 'absolute',
    right: 12,
    top: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(11,14,26,0.6)',
  },
  noteCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
  },
  noteInput: {
    backgroundColor: P.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: P.border,
    color: P.text,
    fontSize: 13,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  bottomSpacer: { height: spacing.lg },
  footerBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: P.border,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: P.bg,
  },
  secondaryBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: P.primary,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: P.surfaceHi,
    shadowOpacity: 0,
    elevation: 0,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(247,242,234,0.06)',
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationCard: {
    marginTop: spacing.sm,
    height: 240,
    borderRadius: radius.xl,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  illustrationPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  starDeco: {
    position: 'absolute',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
  },
  chipGold: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: P.primary,
  },
  chipDark: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
  },
  hintCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: `${P.primary}10`,
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retakeRow: {
    marginTop: 6,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  primaryCTA: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: P.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  waitBack: {
    backgroundColor: 'rgba(247,242,234,0.08)',
    borderWidth: 1,
    borderColor: P.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  waitBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  waitCard: {
    marginTop: spacing.xl,
    width: '100%',
    maxWidth: 320,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  waitIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: `${P.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: P.primaryGlow,
    opacity: 0.15,
  },
  celebBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  celebPill: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: `${P.primary}22`,
    borderWidth: 1,
    borderColor: P.border,
  },
});
