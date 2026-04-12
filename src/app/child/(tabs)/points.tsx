import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { PointWallet, PointTransaction } from '../../../types/models';

export default function ChildPoints() {
  const { t } = useTranslation();
  const uid = auth().currentUser?.uid;
  const [wallet, setWallet] = useState<PointWallet | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);

  useEffect(() => {
    if (!uid) return;
    const unsub = firestore()
      .collection('pointWallets')
      .where('userId', '==', uid)
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
  }, [uid]);

  useEffect(() => {
    if (!wallet) return;
    const unsub = firestore()
      .collection('pointTransactions')
      .where('walletId', '==', wallet.id)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot((snap) => {
        setTransactions(
          snap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as PointTransaction)
          )
        );
      });
    return unsub;
  }, [wallet?.id]);

  const getSourceLabel = (tx: PointTransaction) => {
    switch (tx.sourceType) {
      case 'task_completion':
        return tx.note || t('tasks.completed');
      case 'parent_grant':
        return tx.note || t('points.grantPoints');
      case 'reward_order':
        return tx.note || t('rewards.redeem');
      case 'reward_refund':
        return tx.note || t('common.cancel');
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.balanceSection}>
        <Text style={styles.balanceLabel}>{t('points.balance')}</Text>
        <Text style={styles.balanceValue}>{wallet?.balance || 0}</Text>
        <Text style={styles.balanceUnit}>{t('common.points')}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t('points.history')}</Text>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: tx }) => (
          <View style={styles.txRow}>
            <View style={styles.txInfo}>
              <Text style={styles.txLabel}>{getSourceLabel(tx)}</Text>
              <Text style={styles.txSource}>{tx.sourceType}</Text>
            </View>
            <Text
              style={[
                styles.txAmount,
                tx.delta > 0 ? styles.txPositive : styles.txNegative,
              ]}
            >
              {tx.delta > 0 ? '+' : ''}
              {tx.delta}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('points.noTransactions') || '還沒有交易紀錄'}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  balanceSection: {
    backgroundColor: '#FF9500',
    padding: 32,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 14, color: '#fff', opacity: 0.8 },
  balanceValue: { fontSize: 56, fontWeight: '800', color: '#fff' },
  balanceUnit: { fontSize: 16, color: '#fff', opacity: 0.8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    padding: 16,
    paddingBottom: 8,
  },
  list: { paddingHorizontal: 16 },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 15, color: '#333', fontWeight: '500' },
  txSource: { fontSize: 12, color: '#999', marginTop: 2 },
  txAmount: { fontSize: 18, fontWeight: '700' },
  txPositive: { color: '#34C759' },
  txNegative: { color: '#FF3B30' },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 48,
  },
});
