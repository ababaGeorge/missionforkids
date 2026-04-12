import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Task, TaskInstance, FamilyMembership } from '../../../types/models';

export default function ParentTasks() {
  const { t } = useTranslation();
  const uid = auth().currentUser?.uid;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    points: '10',
    assigneeId: '',
  });

  useEffect(() => {
    if (!uid) return;
    const unsub = firestore()
      .collection('familyMemberships')
      .where('userId', '==', uid)
      .where('status', '==', 'active')
      .limit(1)
      .onSnapshot((snap) => {
        if (!snap.empty) {
          setFamilyId(snap.docs[0].data().familyId);
        }
      });
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
        setTasks(
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Task))
        );
      });
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
        const kids = await Promise.all(
          snap.docs.map(async (doc) => {
            const userId = doc.data().userId;
            const userDoc = await firestore()
              .collection('users')
              .doc(userId)
              .get();
            return {
              id: userId,
              name: userDoc.data()?.displayName || 'Unknown',
            };
          })
        );
        setChildren(kids);
      });
    return unsub;
  }, [familyId]);

  const handleCreateTask = async () => {
    if (!familyId || !uid || !newTask.title.trim()) return;

    const assigneeId = newTask.assigneeId || children[0]?.id;
    if (!assigneeId) {
      Alert.alert('Error', 'Please add a child to the family first');
      return;
    }

    const now = firestore.Timestamp.now();
    const dueDate = firestore.Timestamp.fromDate(
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    );

    const taskRef = await firestore().collection('tasks').add({
      familyId,
      title: newTask.title.trim(),
      points: parseInt(newTask.points) || 10,
      frequency: 'once',
      startDate: now,
      dueDate,
      reviewMode: 'manual',
      assigneeType: 'individual',
      assigneeUserId: assigneeId,
      status: 'active',
      createdBy: uid,
      createdAt: now,
    });

    await firestore().collection('taskInstances').add({
      taskId: taskRef.id,
      userId: assigneeId,
      familyId,
      periodStart: now,
      periodEnd: dueDate,
      gracePeriodEnd: dueDate,
      status: 'pending',
      submissionCount: 0,
      reviewedBy: null,
      reviewedAt: null,
      pointsAwarded: null,
    });

    setNewTask({ title: '', points: '10', assigneeId: '' });
    setShowCreate(false);
  };

  const renderTask = ({ item }: { item: Task }) => (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <Text style={styles.taskPoints}>{item.points} {t('common.points')}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('tasks.noTasks')}</Text>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreate(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('tasks.createTask')}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('tasks.taskName')}
              value={newTask.title}
              onChangeText={(title) => setNewTask((s) => ({ ...s, title }))}
            />

            <TextInput
              style={styles.input}
              placeholder={t('tasks.pointsReward')}
              value={newTask.points}
              onChangeText={(points) => setNewTask((s) => ({ ...s, points }))}
              keyboardType="numeric"
            />

            {children.length > 0 && (
              <View style={styles.childPicker}>
                <Text style={styles.label}>{t('tasks.assignTo')}:</Text>
                {children.map((child) => (
                  <TouchableOpacity
                    key={child.id}
                    style={[
                      styles.childOption,
                      (newTask.assigneeId || children[0]?.id) === child.id &&
                        styles.childOptionSelected,
                    ]}
                    onPress={() =>
                      setNewTask((s) => ({ ...s, assigneeId: child.id }))
                    }
                  >
                    <Text
                      style={[
                        styles.childOptionText,
                        (newTask.assigneeId || children[0]?.id) === child.id &&
                          styles.childOptionTextSelected,
                      ]}
                    >
                      {child.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreate(false)}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateTask}
              >
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 16 },
  taskCard: {
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
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },
  taskPoints: { fontSize: 14, fontWeight: '700', color: '#4A90D9' },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 48,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '300' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  label: { fontSize: 14, color: '#666', marginBottom: 8 },
  childPicker: { marginBottom: 16 },
  childOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  childOptionSelected: {
    borderColor: '#4A90D9',
    backgroundColor: '#EBF3FC',
  },
  childOptionText: { fontSize: 15, color: '#333' },
  childOptionTextSelected: { color: '#4A90D9', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: { color: '#666', fontSize: 16 },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
