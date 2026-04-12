import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { TaskInstance, TaskSubmission } from '../../../types/models';
import { useFamily } from '../../../hooks/useFamily';

interface ReviewItem {
  instance: TaskInstance;
  submission: TaskSubmission;
  taskTitle: string;
  childName: string;
}

export default function ParentReview() {
  const { t } = useTranslation();
  const uid = auth().currentUser?.uid;
  const { family } = useFamily(uid);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    if (!family) return;

    const unsub = firestore()
      .collection('taskInstances')
      .where('familyId', '==', family.id)
      .where('status', '==', 'submitted')
      .onSnapshot(async (snap) => {
        const reviewItems: ReviewItem[] = [];

        for (const doc of snap.docs) {
          const instance = { id: doc.id, ...doc.data() } as TaskInstance;

          const submissionSnap = await firestore()
            .collection('taskSubmissions')
            .where('taskInstanceId', '==', instance.id)
            .orderBy('submittedAt', 'desc')
            .limit(1)
            .get();

          if (submissionSnap.empty) continue;

          const submission = {
            id: submissionSnap.docs[0].id,
            ...submissionSnap.docs[0].data(),
          } as TaskSubmission;

          const taskDoc = await firestore()
            .collection('tasks')
            .doc(instance.taskId)
            .get();
          const taskTitle = taskDoc.data()?.title || 'Unknown';

          const userDoc = await firestore()
            .collection('users')
            .doc(instance.userId)
            .get();
          const childName = userDoc.data()?.displayName || 'Unknown';

          reviewItems.push({ instance, submission, taskTitle, childName });
        }

        setItems(reviewItems);
      });

    return unsub;
  }, [family?.id]);

  const handleApprove = async (item: ReviewItem) => {
    await firestore()
      .collection('taskInstances')
      .doc(item.instance.id)
      .update({
        status: 'approved',
        reviewedBy: uid,
        reviewedAt: firestore.FieldValue.serverTimestamp(),
      });
  };

  const handleReject = async (item: ReviewItem) => {
    const currentCount = item.instance.submissionCount || 0;

    if (currentCount >= 3) {
      await firestore()
        .collection('taskInstances')
        .doc(item.instance.id)
        .update({
          status: 'rejected',
          reviewedBy: uid,
          reviewedAt: firestore.FieldValue.serverTimestamp(),
        });
    } else {
      await firestore()
        .collection('taskInstances')
        .doc(item.instance.id)
        .update({
          status: 'pending',
          reviewedBy: uid,
          reviewedAt: firestore.FieldValue.serverTimestamp(),
        });
    }

    setRejectingId(null);
    setRejectNote('');
  };

  const renderItem = ({ item }: { item: ReviewItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.taskTitle}>{item.taskTitle}</Text>
        <Text style={styles.childName}>{item.childName}</Text>
      </View>

      {item.submission.photoUrls.length > 0 && (
        <Image
          source={{ uri: item.submission.photoUrls[0] }}
          style={styles.photo}
          resizeMode="cover"
        />
      )}

      {rejectingId === item.instance.id ? (
        <View style={styles.rejectForm}>
          <TextInput
            style={styles.noteInput}
            placeholder={t('review.addNote')}
            value={rejectNote}
            onChangeText={setRejectNote}
            multiline
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setRejectingId(null)}
            >
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => handleReject(item)}
            >
              <Text style={styles.rejectBtnText}>{t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => setRejectingId(item.instance.id)}
          >
            <Text style={styles.rejectBtnText}>{t('review.reject')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.approveBtn}
            onPress={() => handleApprove(item)}
          >
            <Text style={styles.approveBtnText}>{t('review.approve')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.instance.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('review.noReviews')}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { marginBottom: 12 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  childName: { fontSize: 13, color: '#666', marginTop: 2 },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  actions: { flexDirection: 'row', gap: 12 },
  approveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#34C759',
    alignItems: 'center',
  },
  approveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
  },
  rejectBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontSize: 15 },
  rejectForm: { gap: 12 },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 48,
  },
});
