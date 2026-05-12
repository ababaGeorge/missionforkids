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
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Starfield count={20} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
      {/* Sheet header */}
      <View style={styles.sheetHeader}>
        <View style={styles.sheetHandle} />
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
          <Body style={{ color: P.muted }}>✕</Body>
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Label color={P.muted}>任務</Label>
        <View style={styles.titleRow}>
          <View style={styles.iconBoxLarge}>
            <Body style={{ fontSize: 34 }}>{emoji}</Body>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <H2 numberOfLines={2}>{task.title}</H2>
            <BodySm style={{ color: P.muted, marginTop: 2 }}>
              做完 +★ {task.points}
            </BodySm>
          </View>
        </View>

        {status === 'rejected' && (
          <View style={styles.rejectedBox}>
            <Label style={{ color: P.accentHot }}>爸媽說要再試一次</Label>
            <Body style={{ marginTop: 6, lineHeight: 22 }}>
              {instance.parentNote || '可以再做一次喔！'}
            </Body>
          </View>
        )}

        {(instance.submissionCount || 0) >= MAX_SUBMISSIONS ? (
          <View style={styles.maxBox}>
            <Body>今天已經試 {MAX_SUBMISSIONS} 次了，明天再來吧。</Body>
          </View>
        ) : (
          <Pressable onPress={handleTakePhoto} style={styles.photoCard}>
            {photoUri ? (
              <>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <View style={styles.retakeChip}>
                  <Label style={{ color: P.text }}>點一下重拍</Label>
                </View>
              </>
            ) : (
              <>
                <Body style={{ fontSize: 48 }}>📷</Body>
                <H3 style={{ marginTop: spacing.sm }}>拍一張照給爸媽看</H3>
                <Muted style={{ marginTop: 4 }}>點一下拍照</Muted>
              </>
            )}
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
      <View style={styles.footerBar}>
        <Pressable onPress={onClose} style={styles.secondaryBtn}>
          <Label style={{ color: P.muted }}>晚點做</Label>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || !photoUri || submitting}
          style={[
            styles.primaryBtn,
            !photoUri && styles.primaryBtnDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={P.bg} />
          ) : (
            <>
              <RoughStar
                size={16}
                color={photoUri ? P.bg : P.muted}
                glow={false}
              />
              <Label
                style={{
                  color: photoUri ? P.bg : P.muted,
                  fontSize: 15,
                  marginLeft: 8,
                }}
              >
                完成任務
              </Label>
            </>
          )}
        </Pressable>
      </View>
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
