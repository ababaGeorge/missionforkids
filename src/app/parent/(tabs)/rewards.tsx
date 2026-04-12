import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { RewardItem, RewardOrder } from '../../../types/models';

export default function ParentRewards() {
  const { t } = useTranslation();
  const uid = auth().currentUser?.uid;
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [orders, setOrders] = useState<RewardOrder[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    pointCost: '50',
    itemType: 'physical' as 'physical' | 'virtual',
  });

  useEffect(() => {
    if (!uid) return;
    const unsub = firestore()
      .collection('familyMemberships')
      .where('userId', '==', uid)
      .where('status', '==', 'active')
      .limit(1)
      .onSnapshot((snap) => {
        if (!snap.empty) setFamilyId(snap.docs[0].data().familyId);
      });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('rewardItems')
      .where('familyId', '==', familyId)
      .where('status', '==', 'active')
      .onSnapshot((snap) => {
        setItems(
          snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as RewardItem))
        );
      });
    return unsub;
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('rewardOrders')
      .where('familyId', '==', familyId)
      .where('status', 'in', ['pending', 'approved', 'delivered'])
      .orderBy('createdAt', 'desc')
      .onSnapshot((snap) => {
        setOrders(
          snap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as RewardOrder)
          )
        );
      });
    return unsub;
  }, [familyId]);

  const handleCreateItem = async () => {
    if (!familyId || !uid || !newItem.title.trim()) return;

    await firestore().collection('rewardItems').add({
      familyId,
      title: newItem.title.trim(),
      description: null,
      pointCost: parseInt(newItem.pointCost) || 50,
      itemType: newItem.itemType,
      imageUrl: null,
      status: 'active',
      createdBy: uid,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    setNewItem({ title: '', pointCost: '50', itemType: 'physical' });
    setShowCreate(false);
  };

  const handleApproveOrder = async (orderId: string) => {
    await firestore().collection('rewardOrders').doc(orderId).update({
      status: 'approved',
      approvedAt: firestore.FieldValue.serverTimestamp(),
    });
  };

  const handleDeliverOrder = async (orderId: string) => {
    const now = new Date();
    const autoComplete = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    await firestore().collection('rewardOrders').doc(orderId).update({
      status: 'delivered',
      deliveredAt: firestore.Timestamp.fromDate(now),
      autoCompleteAt: firestore.Timestamp.fromDate(autoComplete),
    });
  };

  const renderItem = ({ item }: { item: RewardItem }) => (
    <View style={styles.card}>
      <Text style={styles.itemTitle}>{item.title}</Text>
      <Text style={styles.itemCost}>
        {item.pointCost} {t('common.points')}
      </Text>
      <Text style={styles.itemType}>
        {item.itemType === 'physical' ? t('rewards.physical') : t('rewards.virtual')}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.tab, !showOrders && styles.tabActive]}
          onPress={() => setShowOrders(false)}
        >
          <Text style={[styles.tabText, !showOrders && styles.tabTextActive]}>
            {t('rewards.store')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, showOrders && styles.tabActive]}
          onPress={() => setShowOrders(true)}
        >
          <Text style={[styles.tabText, showOrders && styles.tabTextActive]}>
            {t('rewards.pendingOrders')} ({orders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {showOrders ? (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: order }) => (
            <View style={styles.card}>
              <Text style={styles.itemTitle}>
                Order #{order.id.slice(-6)}
              </Text>
              <Text style={styles.itemCost}>
                {order.pointCostSnapshot} {t('common.points')} — {order.status}
              </Text>
              {order.status === 'pending' && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleApproveOrder(order.id)}
                >
                  <Text style={styles.actionBtnText}>{t('review.approve')}</Text>
                </TouchableOpacity>
              )}
              {order.status === 'approved' && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDeliverOrder(order.id)}
                >
                  <Text style={styles.actionBtnText}>
                    {t('rewards.markDelivered')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('review.noReviews')}</Text>
          }
        />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('tasks.noTasks')}</Text>
          }
        />
      )}

      {!showOrders && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreate(true)}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('rewards.createItem')}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('rewards.itemName')}
              value={newItem.title}
              onChangeText={(title) => setNewItem((s) => ({ ...s, title }))}
            />
            <TextInput
              style={styles.input}
              placeholder={t('rewards.pointCost')}
              value={newItem.pointCost}
              onChangeText={(pointCost) =>
                setNewItem((s) => ({ ...s, pointCost }))
              }
              keyboardType="numeric"
            />

            <View style={styles.typePicker}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  newItem.itemType === 'physical' && styles.typeOptionSelected,
                ]}
                onPress={() =>
                  setNewItem((s) => ({ ...s, itemType: 'physical' }))
                }
              >
                <Text>{t('rewards.physical')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  newItem.itemType === 'virtual' && styles.typeOptionSelected,
                ]}
                onPress={() =>
                  setNewItem((s) => ({ ...s, itemType: 'virtual' }))
                }
              >
                <Text>{t('rewards.virtual')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreate(false)}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateItem}
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
  header: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#4A90D9' },
  tabText: { fontSize: 14, color: '#999' },
  tabTextActive: { color: '#4A90D9', fontWeight: '600' },
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
  itemTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  itemCost: { fontSize: 14, color: '#4A90D9', fontWeight: '700', marginTop: 4 },
  itemType: { fontSize: 12, color: '#999', marginTop: 2 },
  actionBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '600' },
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
    elevation: 5,
  },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '300' },
  emptyText: { textAlign: 'center', color: '#999', fontSize: 16, marginTop: 48 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
  typePicker: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  typeOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  typeOptionSelected: { borderColor: '#4A90D9', backgroundColor: '#EBF3FC' },
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
