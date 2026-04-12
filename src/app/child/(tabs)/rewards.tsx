import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { RewardItem, PointWallet } from '../../../types/models';

export default function ChildRewards() {
  const { t } = useTranslation();
  const uid = auth().currentUser?.uid;
  const [items, setItems] = useState<RewardItem[]>([]);
  const [wallet, setWallet] = useState<PointWallet | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);

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
    if (!uid || !familyId) return;
    const unsub = firestore()
      .collection('pointWallets')
      .where('userId', '==', uid)
      .where('familyId', '==', familyId)
      .limit(1)
      .onSnapshot((snap) => {
        if (!snap.empty) {
          setWallet({
            id: snap.docs[0].id,
            ...snap.docs[0].data(),
          } as PointWallet);
        }
      });
    return unsub;
  }, [uid, familyId]);

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

  const handleRedeem = async (item: RewardItem) => {
    if (!uid || !wallet || !familyId) return;

    if (wallet.balance < item.pointCost) {
      Alert.alert('', t('rewards.notEnoughPoints'));
      return;
    }

    // 只建立 order，點數扣除由 Cloud Function (onRewardOrderCreated) 處理
    await firestore().collection('rewardOrders').add({
      familyId,
      itemId: item.id,
      userId: uid,
      pointCostSnapshot: item.pointCost,
      status: 'pending',
      cancelledAt: null,
      approvedAt: null,
      deliveredAt: null,
      completedAt: null,
      autoCompleteAt: null,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  };

  const renderItem = ({ item }: { item: RewardItem }) => {
    const canAfford = (wallet?.balance || 0) >= item.pointCost;

    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemType}>
            {item.itemType === 'physical'
              ? t('rewards.physical')
              : t('rewards.virtual')}
          </Text>
        </View>
        <View style={styles.cardAction}>
          <Text style={styles.cost}>
            {item.pointCost} {t('common.points')}
          </Text>
          <TouchableOpacity
            style={[styles.redeemBtn, !canAfford && styles.redeemBtnDisabled]}
            onPress={() => handleRedeem(item)}
            disabled={!canAfford}
          >
            <Text style={styles.redeemBtnText}>{t('rewards.redeem')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.balanceBar}>
        <Text style={styles.balanceLabel}>{t('points.balance')}</Text>
        <Text style={styles.balanceValue}>
          {wallet?.balance || 0} {t('common.points')}
        </Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('tasks.noTasks')}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  balanceBar: {
    backgroundColor: '#FF9500',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 16, color: '#fff', fontWeight: '500' },
  balanceValue: { fontSize: 24, color: '#fff', fontWeight: '800' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  itemType: { fontSize: 12, color: '#999', marginTop: 2 },
  cardAction: { alignItems: 'flex-end' },
  cost: { fontSize: 14, fontWeight: '700', color: '#FF9500', marginBottom: 8 },
  redeemBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#FF9500',
  },
  redeemBtnDisabled: { backgroundColor: '#ddd' },
  redeemBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 48,
  },
});
