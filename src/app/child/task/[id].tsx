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
import functions from '@react-native-firebase/functions';
import type { Task, TaskInstance } from '../../../types/models';
import { resolveMyChildId, walletDocId } from '../../../lib/childId';
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

export default function ChildTaskDetail() {
  const { id: instanceId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const uid = auth().currentUser?.uid;

  const [instance, setInstance] = useState<InstanceDoc | null>(null);
  const [task, setTask] = useState<(Task & { emoji?: string }) | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [showCameraPrep, setShowCameraPrep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Subscribe to instance
  useEffect(() => {
    if (!instanceId) return;
    const unsub = firestore()
      .collection('taskInstances')
      .doc(instanceId)
      .onSnapshot(
        async (snap) => {
          if (!snap) return;
          const data = snap.data();
          if (!data) {
            setNotFound(true);
            return;
          }
          const inst = { id: snap.id, ...data } as InstanceDoc;
          setInstance(inst);
          if (!task || task.id !== inst.taskId) {
            // R2-18：task get 失敗或 task 文件不存在 → 給「找不到」出口，不再永久轉圈
            try {
              const taskDoc = await firestore()
                .collection('tasks')
                .doc(inst.taskId)
                .get();
              const tData = taskDoc.data();
              if (tData) {
                setTask({ id: taskDoc.id, ...tData } as Task & { emoji?: string });
              } else {
                setNotFound(true);
              }
            } catch (e) {
              // R2-21(R2-18 審查)：dev 下留錯誤線索，避免只看到「找不到」無從除錯
              if (__DEV__) console.warn('[ChildTaskDetail] task 讀取失敗:', e);
              setNotFound(true);
            }
          }
        },
        (err) => {
          // R2-18：權限/網路錯誤也要有出口
          if (__DEV__) console.warn('[ChildTaskDetail] instance snapshot 錯誤:', err);
          setNotFound(true);
        }
      );
    return unsub;
  }, [instanceId]);

  const onClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/child/(tabs)/tasks');
  };

  const launchNativeCamera = async () => {
    setShowCameraPrep(false);
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

  const handleTakePhoto = () => {
    // If retaking after preview, skip prep
    if (photoUri) {
      launchNativeCamera();
      return;
    }
    setShowCameraPrep(true);
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
      // submission + instance 狀態用同一個 batch 原子寫入，計數用 server-side increment
      const subRef = firestore().collection('taskSubmissions').doc();
      const batch = firestore().batch();
      batch.set(subRef, {
        taskInstanceId: instance.id,
        familyId: instance.familyId,
        submittedBy: uid,
        photoUrls: [photoUrl],
        childNote: note.trim() || null,
        aiResult: null,
        aiConfidence: null,
        submittedAt: firestore.FieldValue.serverTimestamp(),
      });
      batch.update(firestore().collection('taskInstances').doc(instance.id), {
        status: 'submitted',
        submissionCount: firestore.FieldValue.increment(1),
        submittedAt: firestore.FieldValue.serverTimestamp(),
      });
      await batch.commit();
      setPhotoUri(null);
      setNote('');
      // B1：AI 小幫手看照片給鼓勵（非阻斷；CF 會把判斷寫回 submission 供家長參考）。
      try {
        const fn = functions().httpsCallable('analyzePhoto');
        const res = await fn({
          photoUrl,
          taskDescription: task.title,
          submissionId: subRef.id,
        });
        const msg = (res.data as any)?.messageZh;
        if (msg) Alert.alert('🤖 AI 小幫手', msg);
      } catch {
        // AI 失敗不影響提交，靜默略過
      }
    } catch (e) {
      Alert.alert('上傳失敗', '檢查一下網路，再試一次。');
    } finally {
      setSubmitting(false);
    }
  };

  // dev：simulator 沒有相機，無法拍照提交。直接送出一筆無照片 submission
  // 讓點數 happy path 可以在 simulator 跑完。dev-gated，可整段移除。
  const handleDevSubmitNoPhoto = async () => {
    if (!instance || !task || !uid) return;
    if ((instance.submissionCount || 0) >= MAX_SUBMISSIONS) {
      Alert.alert('已達提交上限', '這個任務今天不能再提交了。');
      return;
    }
    try {
      setSubmitting(true);
      const batch = firestore().batch();
      batch.set(firestore().collection('taskSubmissions').doc(), {
        taskInstanceId: instance.id,
        familyId: instance.familyId,
        submittedBy: uid,
        photoUrls: [],
        childNote: (note.trim() || '[dev] 無照片提交'),
        aiResult: null,
        aiConfidence: null,
        submittedAt: firestore.FieldValue.serverTimestamp(),
      });
      batch.update(firestore().collection('taskInstances').doc(instance.id), {
        status: 'submitted',
        submissionCount: firestore.FieldValue.increment(1),
        submittedAt: firestore.FieldValue.serverTimestamp(),
      });
      await batch.commit();
      setPhotoUri(null);
      setNote('');
    } catch (e: any) {
      Alert.alert('假提交失敗', e?.message || '再試一次');
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
          {__DEV__ && canSubmit && (
            <Pressable
              onPress={handleDevSubmitNoPhoto}
              disabled={submitting}
              style={styles.devSubmitBtn}
            >
              <Label style={{ color: P.muted, fontSize: 13 }}>
                [dev] 假提交（跳過拍照）
              </Label>
            </Pressable>
          )}
        </View>
      )}
      </KeyboardAvoidingView>

      {showCameraPrep && (
        <CameraPrep
          taskTitle={task.title}
          onCancel={() => setShowCameraPrep(false)}
          onShutter={launchNativeCamera}
        />
      )}
      {submitting && <SendingOverlay />}
    </SafeAreaView>
  );
}

function CameraPrep({
  taskTitle,
  onCancel,
  onShutter,
}: {
  taskTitle: string;
  onCancel: () => void;
  onShutter: () => void;
}) {
  return (
    <View style={camStyles.overlay}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Starfield count={18} />
        {/* Top row: ✕ + REC chip */}
        <View style={camStyles.topRow}>
          <Pressable onPress={onCancel} style={camStyles.closeRound} hitSlop={10}>
            <Text style={{ color: P.text, fontSize: 18 }}>✕</Text>
          </Pressable>
          <View style={camStyles.recChip}>
            <View style={camStyles.recDot} />
            <Text style={{ color: P.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>
              REC
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Viewfinder placeholder (dashed frame) */}
        <View style={camStyles.viewfinder}>
          <Text style={camStyles.viewfinderTitle}>{taskTitle}</Text>
          <View style={{ flex: 1 }} />
          <View style={camStyles.pipChip}>
            <Text style={{ fontSize: 16, marginRight: 6 }}>🦉</Text>
            <Text style={{ color: P.text, fontSize: 12 }}>Pip 陪你</Text>
          </View>
        </View>

        {/* Camera control row */}
        <View style={camStyles.controlRow}>
          <View style={camStyles.controlBtnSm}>
            <Text style={{ color: P.muted, fontSize: 18 }}>⤓</Text>
          </View>
          <Pressable onPress={onShutter} style={camStyles.shutter} hitSlop={10}>
            <View style={camStyles.shutterInner} />
          </Pressable>
          <View style={camStyles.controlBtnSm}>
            <Text style={{ color: P.muted, fontSize: 16 }}>📷</Text>
          </View>
          <View style={camStyles.controlBtnSm}>
            <Text style={{ color: P.muted, fontSize: 18 }}>↻</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const camStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: P.bg,
    zIndex: 100,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  closeRound: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(247,242,234,0.08)',
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(247,201,40,0.18)',
    borderWidth: 1,
    borderColor: P.primary,
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    marginRight: 6,
  },
  viewfinder: {
    flex: 1,
    marginHorizontal: 18,
    marginVertical: 8,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: P.primary,
    borderStyle: 'dashed',
    backgroundColor: P.surface,
    padding: 18,
  },
  viewfinderTitle: {
    color: P.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  pipChip: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(247,242,234,0.08)',
    borderWidth: 1,
    borderColor: P.border,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  controlBtnSm: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: P.primary,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    borderWidth: 3,
    borderColor: P.bg,
  },
});

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
  const router = useRouter();
  const goRewards = () => router.replace('/child/(tabs)/rewards' as any);
  const fmtTime = (ts: any): string => {
    if (!ts) return '剛剛';
    const d: Date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
    const h = d.getHours();
    const m = d.getMinutes();
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Starfield count={28} />
      <View style={styles.waitTopHeader}>
        <View style={{ width: 32 }} />
        <View style={styles.waitHandleWrap}>
          <View style={styles.sheetHandle} />
          <Muted style={{ fontSize: 11, marginTop: 4 }}>下滑關閉 · 或點 ✕</Muted>
        </View>
        <Pressable onPress={onClose} style={styles.closeRound} hitSlop={10}>
          <Text style={{ color: P.text, fontSize: 16 }}>✕</Text>
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Delivered chip */}
        <View style={styles.deliveredChip}>
          <Text style={{ fontSize: 12, color: P.primary }}>✨</Text>
          <Label
            style={{ marginLeft: 6, color: P.primary, fontSize: 12, fontWeight: '700' }}
          >
            星光已送達
          </Label>
        </View>
        {/* Headline */}
        <Display style={{ marginTop: spacing.md }}>等爸媽看看你做得多棒</Display>
        <Muted style={{ marginTop: 6, fontSize: 13 }}>
          星光先幫你保留著，看過就會變亮
        </Muted>
        {/* Big illustration with delivered tag */}
        <View style={styles.illustrationCard}>
          <View style={styles.deliveredTag}>
            <Label style={{ color: P.primary, fontSize: 11, fontWeight: '700' }}>
              ✓ 送達
            </Label>
          </View>
          <Text style={{ fontSize: 88, lineHeight: 100 }}>{emoji}</Text>
        </View>
        {/* Task summary card */}
        <View style={styles.deliveredTaskRow}>
          <View style={{ flex: 1 }}>
            <H3>{task.title}</H3>
            <Muted style={{ marginTop: 2, fontSize: 12 }}>
              {fmtTime(submittedAt)} · 今天
            </Muted>
          </View>
          <Text style={{ color: P.primary, fontSize: 14, marginRight: 4 }}>☆</Text>
          <Data style={{ color: P.primary, fontSize: 22, fontWeight: '700' }}>
            {task.points}
          </Data>
        </View>
      </ScrollView>
      {/* Footer: two buttons */}
      <View style={styles.footerBar}>
        <Pressable onPress={goRewards} style={styles.secondaryBtn}>
          <Label style={{ color: P.muted }}>看獎勵</Label>
        </Pressable>
        <Pressable onPress={onClose} style={styles.primaryBtn}>
          <RoughStar size={14} color={P.bg} glow={false} />
          <Label style={{ color: P.bg, fontSize: 15, marginLeft: 8, fontWeight: '800' }}>
            回到任務
          </Label>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SendingOverlay() {
  return (
    <View style={camStyles.overlay}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Starfield count={60} />
        <View style={styles.waitBody}>
          <View style={styles.pipRing}>
            <View style={styles.pipRingInner}>
              <Text style={{ fontSize: 96, lineHeight: 110 }}>🦉</Text>
            </View>
          </View>
          <Display style={{ textAlign: 'center', marginTop: spacing.lg }}>
            星光正在傳送…
          </Display>
          <Muted style={{ marginTop: 10, textAlign: 'center', maxWidth: 280 }}>
            Pip 正在幫你把今天的成果送出去
          </Muted>
          <View style={styles.dotRow}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>
      </SafeAreaView>
    </View>
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
  const uid = auth().currentUser?.uid;
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!uid || !task.familyId) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    resolveMyChildId(uid).then((childId) => {
      if (cancelled) return;
      unsub = firestore()
        .collection('pointWallets')
        .doc(walletDocId(task.familyId, childId))
        .onSnapshot((doc) => {
          if (doc && doc.exists()) setWalletBalance(doc.data()?.balance || 0);
        });
    });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [uid, task.familyId]);

  const goRewards = () => {
    router.replace('/child/(tabs)/rewards' as any);
  };

  // If wallet balance is loaded, show cumulative total (balance already includes this award).
  // Otherwise just show this award.
  const showTotal = walletBalance !== null && walletBalance >= pointsAwarded;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: P.bg }]} edges={['top', 'bottom']}>
      <Starfield count={50} />
      <View style={styles.celebGlow} pointerEvents="none" />
      {/* Scatter deco stars */}
      <Text style={[celebStyles.decoStar, { top: 90, left: 40, fontSize: 18 }]}>★</Text>
      <Text style={[celebStyles.decoStar, { top: 130, left: 100, fontSize: 14 }]}>★</Text>
      <Text style={[celebStyles.decoStar, { top: 180, left: 60, fontSize: 12 }]}>★</Text>
      <Text style={[celebStyles.decoStar, { top: 220, right: 60, fontSize: 18 }]}>★</Text>
      <Text style={[celebStyles.decoStar, { top: 320, right: 50, fontSize: 14 }]}>★</Text>
      <Text style={[celebStyles.decoStar, { top: 380, right: 110, fontSize: 12 }]}>★</Text>
      <Text style={[celebStyles.decoStar, { bottom: 320, left: 80, fontSize: 16 }]}>★</Text>
      <Text style={[celebStyles.decoStar, { bottom: 280, left: 140, fontSize: 12 }]}>★</Text>
      <Text style={[celebStyles.decoStar, { bottom: 240, right: 90, fontSize: 18 }]}>★</Text>

      <View style={styles.celebBody}>
        {/* Big star with +N overlay */}
        <View style={celebStyles.bigStarWrap}>
          <Text style={celebStyles.bigStarGlyph}>★</Text>
          <Text style={celebStyles.bigStarText}>+{pointsAwarded}</Text>
        </View>
        <Display style={{ fontSize: 36, marginTop: spacing.lg, textAlign: 'center' }}>
          做得好！
        </Display>
        <Muted style={{ marginTop: 8, fontSize: 14 }}>
          {showTotal ? (
            <>
              總星光 <Text style={{ color: P.primary }}>★ {walletBalance}</Text>
            </>
          ) : (
            <>+{pointsAwarded} 顆星，加進你的天空</>
          )}
        </Muted>
      </View>
      <View style={styles.footerBar}>
        <Pressable onPress={goRewards} style={styles.secondaryBtn}>
          <Label style={{ color: P.muted }}>看獎勵</Label>
        </Pressable>
        <Pressable onPress={onClose} style={[styles.primaryBtn, { flex: 1 }]}>
          <Label style={{ color: P.bg, fontSize: 15, fontWeight: '800' }}>
            下一個 →
          </Label>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const celebStyles = StyleSheet.create({
  decoStar: {
    position: 'absolute',
    color: '#F7C928',
  },
  bigStarWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bigStarGlyph: {
    position: 'absolute',
    fontSize: 180,
    color: '#F7C928',
    lineHeight: 180,
    textShadowColor: 'rgba(247,201,40,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  bigStarText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1B2236',
    zIndex: 10,
  },
});

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
  devSubmitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
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
  pipRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: `${P.primary}50`,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitTopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  waitHandleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  closeRound: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(247,242,234,0.08)',
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveredChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.primary,
    backgroundColor: 'rgba(247,201,40,0.10)',
    marginTop: spacing.sm,
  },
  deliveredTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(247,201,40,0.16)',
    borderWidth: 1,
    borderColor: P.primary,
  },
  deliveredTaskRow: {
    marginTop: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pipRingInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,201,40,0.08)',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: P.primary,
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
