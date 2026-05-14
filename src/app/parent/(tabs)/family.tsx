import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import type { Family, FamilyMembership, User } from '../../../types/models';
import { createInviteCode, createParentInviteCode } from '../../../lib/inviteCode';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import { RoughStar } from '../../../design/RoughStar';
import { Empty } from '../../../design/Empty';
import {
  Display,
  H3,
  Body,
  BodySm,
  Label,
  Muted,
  Data,
} from '../../../design/Text';

type MemberRow = { membership: FamilyMembership; user: User };

type InviteRow = {
  code: string;
  childUserId: string | null;
  childName: string;
  role: 'parent' | 'child';
  used: boolean;
  expired: boolean;
  expiresAt: Date;
};

export default function FamilyScreen() {
  const uid = auth().currentUser?.uid;
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);

  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [showGrant, setShowGrant] = useState(false);
  const [grantTarget, setGrantTarget] = useState<{ userId: string; name: string } | null>(null);
  const [grantAmount, setGrantAmount] = useState('10');
  const [grantReason, setGrantReason] = useState('');

  useEffect(() => {
    if (!uid) return;
    const unsub = firestore()
      .collection('familyMemberships')
      .where('userId', '==', uid)
      .where('status', '==', 'active')
      .limit(1)
      .onSnapshot(async (snap) => {
        if (!snap || snap.empty) {
          setFamily(null);
          return;
        }
        const fid = snap.docs[0].data().familyId;
        const fdoc = await firestore().collection('families').doc(fid).get();
        const fdata = fdoc.data();
        if (fdata) setFamily({ id: fdoc.id, ...fdata } as Family);
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
        if (!snap) return;
        const rows: MemberRow[] = [];
        for (const d of snap.docs) {
          const mem = { id: d.id, ...d.data() } as FamilyMembership;
          const udoc = await firestore().collection('users').doc(mem.userId).get();
          const ud = udoc.data();
          if (ud) rows.push({ membership: mem, user: { id: udoc.id, ...ud } as User });
        }
        setMembers(rows);
      });
    return unsub;
  }, [family?.id]);

  useEffect(() => {
    if (!family) return;
    const unsub = firestore()
      .collection('inviteCodes')
      .where('familyId', '==', family.id)
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const rows: InviteRow[] = [];
        for (const d of snap.docs) {
          const data = d.data();
          const expiresAt = data.expiresAt.toDate();
          const role = data.role || 'child';
          let cn = '';
          if (role === 'parent') cn = '家長';
          else if (data.childUserId) {
            try {
              const cd = await firestore().collection('users').doc(data.childUserId).get();
              cn = cd.data()?.displayName || '';
            } catch {}
          }
          rows.push({
            code: d.id,
            childUserId: data.childUserId || null,
            childName: cn,
            role,
            used: data.used,
            expired: expiresAt < new Date(),
            expiresAt,
          });
        }
        rows.sort((a, b) => {
          if (!a.used && !a.expired && (b.used || b.expired)) return -1;
          if ((a.used || a.expired) && !b.used && !b.expired) return 1;
          return b.expiresAt.getTime() - a.expiresAt.getTime();
        });
        setInvites(rows);
      });
    return unsub;
  }, [family?.id]);

  const handleCreateFamily = async () => {
    if (!uid || !familyName.trim()) return;
    const ref = await firestore().collection('families').add({
      displayName: familyName.trim(),
      defaultGraceDays: 2,
      createdBy: uid,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    await firestore()
      .collection('familyMemberships')
      .doc(`${uid}_${ref.id}`)
      .set({
        familyId: ref.id,
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
      const childRef = await firestore().collection('users').add({
        displayName: childName.trim(),
        avatarUrl: null,
        authProvider: 'anonymous',
        authProviderId: '',
        roleType: 'child',
        birthday: null,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      await firestore()
        .collection('familyMemberships')
        .doc(`${childRef.id}_${family.id}`)
        .set({
          familyId: family.id,
          userId: childRef.id,
          role: 'child',
          status: 'active',
          invitedBy: uid,
          joinedAt: firestore.FieldValue.serverTimestamp(),
        });
      const code = await createInviteCode(childRef.id, family.id);
      setGeneratedCode(code);
      setChildName('');
    } catch (e: any) {
      Alert.alert('錯誤', e.message || '加入失敗');
    }
  };

  const handleInviteParent = async () => {
    if (!uid || !family) return;
    try {
      const code = await createParentInviteCode(family.id, uid);
      setGeneratedCode(code);
      setShowAddChild(true);
    } catch (e: any) {
      Alert.alert('錯誤', e.message || '產生邀請碼失敗');
    }
  };

  const handleRegenerate = async (childId: string) => {
    if (!family) return;
    try {
      const code = await createInviteCode(childId, family.id);
      Alert.alert('邀請碼', code);
    } catch (e: any) {
      Alert.alert('錯誤', e.message || '失敗');
    }
  };

  const handleGrant = async () => {
    if (!uid || !family || !grantTarget) return;
    const amount = parseInt(grantAmount);
    if (!amount || amount <= 0) return;
    try {
      const fn = functions().httpsCallable('grantPoints');
      await fn({
        childUserId: grantTarget.userId,
        familyId: family.id,
        amount,
        reason: grantReason.trim() || '爸媽直接給',
      });
      Alert.alert('', `+${amount} ★ → ${grantTarget.name}`);
      setShowGrant(false);
      setGrantAmount('10');
      setGrantReason('');
      setGrantTarget(null);
    } catch (e: any) {
      Alert.alert('錯誤', e.message || '失敗');
    }
  };

  if (!family) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Starfield count={10} />
        <View style={styles.center}>
          <Display style={{ textAlign: 'center', marginBottom: spacing.lg }}>
            還沒有家庭
          </Display>
          <Muted style={{ textAlign: 'center', marginBottom: spacing.xl }}>
            建立一個家庭，然後邀請孩子加入
          </Muted>
          <Pressable
            onPress={() => setShowCreateFamily(true)}
            style={styles.primaryBtn}
          >
            <Label style={{ color: P.bg, fontSize: 14 }}>建立家庭</Label>
          </Pressable>
        </View>
        {renderCreateFamilyModal()}
      </SafeAreaView>
    );
  }

  const parents = members.filter((m) => m.membership.role === 'parent');
  const children = members.filter((m) => m.membership.role === 'child');

  function renderCreateFamilyModal() {
    return (
      <Modal visible={showCreateFamily} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={modalStyles.overlay}>
              <View style={modalStyles.sheet}>
                <H3 style={{ marginBottom: spacing.md }}>建立家庭</H3>
                <TextInput
                  style={modalStyles.input}
                  placeholder="家庭名稱"
                  placeholderTextColor={P.muted}
                  value={familyName}
                  onChangeText={setFamilyName}
                />
                <View style={modalStyles.actions}>
                  <Pressable
                    onPress={() => setShowCreateFamily(false)}
                    style={modalStyles.cancel}
                  >
                    <Label style={{ color: P.muted }}>取消</Label>
                  </Pressable>
                  <Pressable
                    onPress={handleCreateFamily}
                    style={modalStyles.save}
                  >
                    <Label style={{ color: P.bg }}>建立</Label>
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Starfield count={10} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Label color={P.muted}>設定</Label>
          <Display style={{ marginTop: 2 }}>家庭與權限</Display>
          <Muted style={{ marginTop: 4, fontSize: 12 }}>{family.displayName}</Muted>
        </View>

        {parents.length > 0 && (
          <View style={styles.section}>
            <Label color={P.muted} style={{ marginBottom: spacing.sm }}>
              家長
            </Label>
            {parents.map((m) => (
              <View key={m.membership.id} style={styles.memberRow}>
                <View style={[styles.avatar, { backgroundColor: P.blue }]}>
                  <Label style={{ color: P.bg, fontSize: 14 }}>
                    {m.user.displayName[0]?.toUpperCase() || '?'}
                  </Label>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <H3 style={{ fontSize: 15 }}>{m.user.displayName}</H3>
                  <Muted style={{ fontSize: 11, marginTop: 2 }}>家長</Muted>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Label color={P.muted} style={{ marginBottom: spacing.sm }}>
            小孩
          </Label>
          {children.length === 0 ? (
            <Muted>還沒有小孩加入</Muted>
          ) : (
            children.map((m) => (
              <View key={m.membership.id} style={styles.memberRow}>
                <View style={[styles.avatar, { backgroundColor: P.primary }]}>
                  <Label style={{ color: P.bg, fontSize: 14 }}>
                    {m.user.displayName[0]?.toUpperCase() || '?'}
                  </Label>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <H3 style={{ fontSize: 15 }}>{m.user.displayName}</H3>
                  <Muted style={{ fontSize: 11, marginTop: 2 }}>小孩</Muted>
                </View>
                <Pressable
                  onPress={() => {
                    setGrantTarget({
                      userId: m.user.id,
                      name: m.user.displayName,
                    });
                    setShowGrant(true);
                  }}
                  style={styles.grantPill}
                >
                  <RoughStar size={12} glow={false} />
                  <Label style={{ color: P.primary, fontSize: 11, marginLeft: 4 }}>
                    +
                  </Label>
                </Pressable>
              </View>
            ))
          )}
        </View>

        {invites.length > 0 && (
          <View style={styles.section}>
            <Label color={P.muted} style={{ marginBottom: spacing.sm }}>
              邀請碼
            </Label>
            {invites.map((code) => {
              const statusColor = code.used
                ? P.muted
                : code.expired
                ? P.accentHot
                : P.green;
              const statusLabel = code.used
                ? '已使用'
                : code.expired
                ? '已過期'
                : '有效';
              return (
                <View key={code.code} style={styles.codeRow}>
                  <View style={{ flex: 1 }}>
                    <Data
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        letterSpacing: 2,
                      }}
                    >
                      {code.code}
                    </Data>
                    <Muted style={{ fontSize: 11, marginTop: 2 }}>
                      {code.childName}
                    </Muted>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: `${statusColor}22` },
                      ]}
                    >
                      <Label
                        style={{ color: statusColor, fontSize: 11 }}
                      >
                        {statusLabel}
                      </Label>
                    </View>
                    {(code.used || code.expired) &&
                      code.role === 'child' &&
                      code.childUserId && (
                        <Pressable
                          onPress={() => handleRegenerate(code.childUserId!)}
                          style={{ marginTop: 4 }}
                        >
                          <Label style={{ color: P.primary, fontSize: 11 }}>
                            重新產生
                          </Label>
                        </Pressable>
                      )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <Label color={P.muted} style={{ marginBottom: spacing.sm }}>
            一般
          </Label>
          {([
            { key: 'lang', label: '語言', value: '中文' },
            { key: 'notif', label: '通知', value: '開啟' },
            { key: 'review', label: '審核方式', value: '手動' },
            { key: 'screen', label: '螢幕時間', value: '未設定' },
          ] as const).map((row) => (
            <Pressable
              key={row.key}
              onPress={() => Alert.alert(row.label, '尚未開放')}
              style={styles.settingRow}
            >
              <Body style={{ fontSize: 14, fontWeight: '700' }}>{row.label}</Body>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Muted style={{ fontSize: 13 }}>{row.value}</Muted>
                <Muted style={{ fontSize: 13 }}>›</Muted>
              </View>
            </Pressable>
          ))}
          <Pressable
            onPress={() => auth().signOut()}
            style={styles.settingRow}
          >
            <Body style={{ fontSize: 14, fontWeight: '700', color: P.accentHot }}>登出</Body>
            <Muted style={{ fontSize: 13 }}>›</Muted>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => {
          Alert.alert('邀請成員', '', [
            { text: '加入小孩', onPress: () => setShowAddChild(true) },
            { text: '邀請家長', onPress: handleInviteParent },
            { text: '取消', style: 'cancel' },
          ]);
        }}
        style={styles.fab}
        hitSlop={10}
      >
        <Body style={{ color: P.bg, fontSize: 26, fontWeight: '800' }}>+</Body>
      </Pressable>

      {renderCreateFamilyModal()}

      {/* Add child / invite parent modal */}
      <Modal visible={showAddChild} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={modalStyles.overlay}>
              <View style={modalStyles.sheet}>
                {generatedCode ? (
                  <>
                    <H3 style={{ marginBottom: spacing.md, textAlign: 'center' }}>
                      邀請碼
                    </H3>
                    <Display
                      style={{
                        color: P.primary,
                        textAlign: 'center',
                        letterSpacing: 8,
                        marginVertical: spacing.lg,
                      }}
                    >
                      {generatedCode}
                    </Display>
                    <Muted style={{ textAlign: 'center', marginBottom: spacing.lg }}>
                      在對方裝置輸入此邀請碼（24 小時內有效）
                    </Muted>
                    <Pressable
                      onPress={() => {
                        setGeneratedCode(null);
                        setShowAddChild(false);
                      }}
                      style={modalStyles.save}
                    >
                      <Label style={{ color: P.bg }}>完成</Label>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <H3 style={{ marginBottom: spacing.md }}>加入小孩</H3>
                    <TextInput
                      style={modalStyles.input}
                      placeholder="小孩名字"
                      placeholderTextColor={P.muted}
                      value={childName}
                      onChangeText={setChildName}
                      returnKeyType="done"
                      onSubmitEditing={handleAddChild}
                    />
                    <View style={modalStyles.actions}>
                      <Pressable
                        onPress={() => setShowAddChild(false)}
                        style={modalStyles.cancel}
                      >
                        <Label style={{ color: P.muted }}>取消</Label>
                      </Pressable>
                      <Pressable
                        onPress={handleAddChild}
                        style={modalStyles.save}
                      >
                        <Label style={{ color: P.bg }}>建立</Label>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Grant points */}
      <Modal visible={showGrant} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={modalStyles.overlay}>
              <View style={modalStyles.sheet}>
                <H3 style={{ marginBottom: spacing.md }}>
                  直接給點 → {grantTarget?.name}
                </H3>
                <TextInput
                  style={modalStyles.input}
                  placeholder="點數"
                  placeholderTextColor={P.muted}
                  value={grantAmount}
                  onChangeText={setGrantAmount}
                  keyboardType="numeric"
                  autoFocus
                />
                <TextInput
                  style={modalStyles.input}
                  placeholder="原因（選填）"
                  placeholderTextColor={P.muted}
                  value={grantReason}
                  onChangeText={setGrantReason}
                />
                <View style={modalStyles.actions}>
                  <Pressable
                    onPress={() => {
                      setShowGrant(false);
                      setGrantTarget(null);
                    }}
                    style={modalStyles.cancel}
                  >
                    <Label style={{ color: P.muted }}>取消</Label>
                  </Pressable>
                  <Pressable onPress={handleGrant} style={modalStyles.save}>
                    <Label style={{ color: P.bg }}>+{grantAmount || '0'} ★</Label>
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  scroll: { paddingBottom: 140 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: P.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: `${P.primary}18`,
    borderWidth: 1,
    borderColor: P.border,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: P.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: P.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: P.primary,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 92,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: P.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: P.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  input: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.bg,
    color: P.text,
    fontSize: 15,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
  },
  cancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
  },
  save: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
  },
});
