import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { TaskInstance, Task } from '../../../types/models';
import { pickPhoto, uploadPhoto } from '../../../lib/photoUpload';
import CelebrationOverlay from '../../../components/CelebrationOverlay';

interface TaskWithInstance {
  task: Task;
  instance: TaskInstance;
}

const MAX_SUBMISSIONS = 3;

export default function ChildTasks() {
  const { t } = useTranslation();
  const uid = auth().currentUser?.uid;
  const [tasks, setTasks] = useState<TaskWithInstance[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    points: number;
  } | null>(null);

  // 追蹤上一次的 instance 狀態，用來偵測 approved 轉換
  const prevStatuses = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!uid) return;

    const unsub = firestore()
      .collection('taskInstances')
      .where('userId', '==', uid)
      .where('status', 'in', ['pending', 'submitted', 'approved', 'rejected'])
      .onSnapshot(async (snap) => {
        const items: TaskWithInstance[] = [];
        for (const doc of snap.docs) {
          const instance = { id: doc.id, ...doc.data() } as TaskInstance;
          const taskDoc = await firestore()
            .collection('tasks')
            .doc(instance.taskId)
            .get();
          const taskData = taskDoc.data();
          if (taskData) {
            items.push({
              task: { id: taskDoc.id, ...taskData } as Task,
              instance,
            });
          }

          // 偵測 approved 轉換 → 觸發慶祝動畫
          const prevStatus = prevStatuses.current[doc.id];
          if (prevStatus && prevStatus !== 'approved' && instance.status === 'approved') {
            setCelebration({ points: instance.pointsAwarded || 0 });
          }
          prevStatuses.current[doc.id] = instance.status;
        }
        setTasks(items);
      });

    return unsub;
  }, [uid]);

  const handleSubmit = async (item: TaskWithInstance) => {
    // 檢查提交上限
    if ((item.instance.submissionCount || 0) >= MAX_SUBMISSIONS) {
      Alert.alert(
        t('common.error'),
        t('tasks.maxSubmissions') || '已達提交上限'
      );
      return;
    }

    try {
      // 開啟相機拍照
      const photoUri = await pickPhoto();
      if (!photoUri) return; // 使用者取消

      setUploading(item.instance.id);

      // 上傳到 Firebase Storage
      const photoUrl = await uploadPhoto(item.instance.familyId, photoUri);

      // 建立 submission 記錄
      await firestore().collection('taskSubmissions').add({
        taskInstanceId: item.instance.id,
        familyId: item.instance.familyId,
        submittedBy: uid,
        photoUrls: [photoUrl],
        aiResult: null,
        aiConfidence: null,
        submittedAt: firestore.FieldValue.serverTimestamp(),
      });

      // 更新 instance 狀態
      await firestore()
        .collection('taskInstances')
        .doc(item.instance.id)
        .update({
          status: 'submitted',
          submissionCount: (item.instance.submissionCount || 0) + 1,
        });
    } catch (error: any) {
      if (error.message === 'CAMERA_PERMISSION_DENIED') {
        Alert.alert(
          t('common.error'),
          t('tasks.cameraPermission') || '請允許使用相機'
        );
      } else {
        Alert.alert(
          t('common.error'),
          t('tasks.uploadFailed') || '無法上傳照片，請檢查網路'
        );
      }
    } finally {
      setUploading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'submitted':
        return '#007AFF';
      case 'approved':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('tasks.pending') || '待完成';
      case 'submitted':
        return t('tasks.pendingReview');
      case 'approved':
        return t('tasks.approved');
      case 'rejected':
        return t('tasks.tryAgain');
      default:
        return status;
    }
  };

  const canSubmit = useCallback(
    (item: TaskWithInstance) =>
      (item.instance.status === 'pending' ||
        item.instance.status === 'rejected') &&
      (item.instance.submissionCount || 0) < MAX_SUBMISSIONS,
    []
  );

  const renderItem = ({ item }: { item: TaskWithInstance }) => {
    const isUploading = uploading === item.instance.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.taskTitle}>{item.task.title}</Text>
          <Text style={styles.points}>
            {item.task.points} {t('common.points')}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  getStatusColor(item.instance.status) + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(item.instance.status) },
              ]}
            >
              {getStatusLabel(item.instance.status)}
            </Text>
          </View>

          {canSubmit(item) && (
            <TouchableOpacity
              style={[styles.submitBtn, isUploading && styles.submitBtnDisabled]}
              onPress={() => handleSubmit(item)}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {t('tasks.submitPhoto')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* 提交次數提示 */}
        {item.instance.status === 'rejected' &&
          (item.instance.submissionCount || 0) > 0 && (
            <Text style={styles.attemptHint}>
              {item.instance.submissionCount}/{MAX_SUBMISSIONS}{' '}
              {t('tasks.attempts') || '次提交'}
            </Text>
          )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={(item) => item.instance.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('tasks.noTasks')}</Text>
        }
      />

      {celebration && (
        <CelebrationOverlay
          points={celebration.points}
          onComplete={() => setCelebration(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskTitle: { fontSize: 18, fontWeight: '700', color: '#333', flex: 1 },
  points: { fontSize: 16, fontWeight: '800', color: '#FF9500' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: { fontSize: 13, fontWeight: '600' },
  submitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#FF9500',
    minWidth: 80,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  attemptHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 48,
  },
});
