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
import { Family, FamilyMembership, User } from '../../../types/models';
import { createInviteCode } from '../../../lib/inviteCode';

interface MemberWithUser {
  membership: FamilyMembership;
  user: User;
}

export default function FamilyScreen() {
  const { t } = useTranslation();
  const uid = auth().currentUser?.uid;
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [childName, setChildName] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = firestore()
      .collection('familyMemberships')
      .where('userId', '==', uid)
      .where('status', '==', 'active')
      .limit(1)
      .onSnapshot(async (snap) => {
        if (snap.empty) {
          setFamily(null);
          return;
        }
        const familyId = snap.docs[0].data().familyId;
        const familyDoc = await firestore()
          .collection('families')
          .doc(familyId)
          .get();
        const familyData = familyDoc.data();
        if (familyData) {
          setFamily({ id: familyDoc.id, ...familyData } as Family);
        }
      });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!family) return;
    const unsub = firestore()
      .collection('familyMemberships')
      .where('familyId', '==', family.id)
      .where('status', '==', 'active')
      .onSnapshot(async (snap) => {
        const memberList: MemberWithUser[] = [];
        for (const doc of snap.docs) {
          const mem = { id: doc.id, ...doc.data() } as FamilyMembership;
          const userDoc = await firestore()
            .collection('users')
            .doc(mem.userId)
            .get();
          const userData = userDoc.data();
          if (userData) {
            memberList.push({
              membership: mem,
              user: { id: userDoc.id, ...userData } as User,
            });
          }
        }
        setMembers(memberList);
      });
    return unsub;
  }, [family?.id]);

  const handleCreateFamily = async () => {
    if (!uid || !familyName.trim()) return;

    const familyRef = await firestore().collection('families').add({
      displayName: familyName.trim(),
      defaultGraceDays: 2,
      createdBy: uid,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    await firestore().collection('familyMemberships').add({
      familyId: familyRef.id,
      userId: uid,
      role: 'parent',
      status: 'active',
      invitedBy: uid,
      joinedAt: firestore.FieldValue.serverTimestamp(),
    });

    setFamilyName('');
    setShowCreateFamily(false);
  };

  const handleAddChild = async () => {
    if (!uid || !family || !childName.trim()) return;

    try {
      // 建立 child user doc（authProviderId 留空，等孩子用邀請碼加入時填入）
      const childUserRef = await firestore().collection('users').add({
        displayName: childName.trim(),
        avatarUrl: null,
        authProvider: 'anonymous',
        authProviderId: '',
        roleType: 'child',
        birthday: null,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      await firestore().collection('familyMemberships').add({
        familyId: family.id,
        userId: childUserRef.id,
        role: 'child',
        status: 'active',
        invitedBy: uid,
        joinedAt: firestore.FieldValue.serverTimestamp(),
      });

      // 產生 6 位邀請碼（24 小時有效）
      const code = await createInviteCode(childUserRef.id, family.id);
      setGeneratedCode(code);
      setChildName('');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  if (!family) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.noFamilyText}>
          {t('family.createFamily')}
        </Text>
        <TouchableOpacity
          style={styles.createFamilyBtn}
          onPress={() => setShowCreateFamily(true)}
        >
          <Text style={styles.createFamilyBtnText}>
            {t('family.createFamily')}
          </Text>
        </TouchableOpacity>

        <Modal visible={showCreateFamily} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('family.createFamily')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('family.familyName')}
                value={familyName}
                onChangeText={setFamilyName}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCreateFamily(false)}
                >
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleCreateFamily}
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

  return (
    <View style={styles.container}>
      <View style={styles.familyHeader}>
        <Text style={styles.familyName}>{family.displayName}</Text>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.membership.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.memberCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.user.displayName[0]?.toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.memberName}>{item.user.displayName}</Text>
              <Text style={styles.memberRole}>{item.membership.role}</Text>
            </View>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddChild(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showAddChild} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {generatedCode ? (
              <>
                <Text style={styles.modalTitle}>
                  {t('family.inviteCode') || '邀請碼'}
                </Text>
                <Text style={styles.codeDisplay}>{generatedCode}</Text>
                <Text style={styles.codeHint}>
                  {t('family.inviteCodeHint') ||
                    '請在孩子的裝置上輸入此邀請碼（24 小時內有效）'}
                </Text>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => {
                    setGeneratedCode(null);
                    setShowAddChild(false);
                  }}
                >
                  <Text style={styles.saveButtonText}>{t('common.done') || '完成'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>{t('family.addChild')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('family.childName')}
                  value={childName}
                  onChangeText={setChildName}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowAddChild(false)}
                  >
                    <Text style={styles.cancelButtonText}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleAddChild}
                  >
                    <Text style={styles.saveButtonText}>
                      {t('common.save')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  noFamilyText: { fontSize: 18, color: '#666', marginBottom: 24 },
  createFamilyBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: '#4A90D9',
  },
  createFamilyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  familyHeader: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  familyName: { fontSize: 22, fontWeight: '700', color: '#333' },
  list: { padding: 16 },
  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  memberName: { fontSize: 16, fontWeight: '600', color: '#333' },
  memberRole: { fontSize: 13, color: '#999', textTransform: 'capitalize' },
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
  codeDisplay: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FF9500',
    textAlign: 'center',
    letterSpacing: 8,
    marginVertical: 24,
    fontFamily: 'Courier',
  },
  codeHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
});
