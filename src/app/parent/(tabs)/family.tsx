import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import type { Family, FamilyMembership, User } from '../../../types/models';
import { createFamilyInvite } from '../../../lib/familyInvite';
import { buildInviteLink } from '../../../lib/inviteLink';
import { resolveMemberUser } from '../../../lib/memberName';
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
} from '../../../design/Text';

type MemberRow = { membership: FamilyMembership; user: User };

// family-scoped 顯示：暱稱優先於真實 displayName
const nameOf = (m: MemberRow): string =>
  m.membership.nickname?.trim() || m.user.displayName || '?';
const avatarOf = (m: MemberRow): string | null =>
  m.membership.avatarEmoji?.trim() || null;

const AVATAR_EMOJIS = [
  '🦊', '🐯', '🐻', '🐼', '🐰', '🐱', '🐶', '🦁',
  '🐵', '🐸', '🐧', '🦄', '🌟', '⚽', '🎨', '🚀',
];

export default function FamilyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const uid = auth().currentUser?.uid;
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [showInviteEmail, setShowInviteEmail] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [showGrant, setShowGrant] = useState(false);
  const [grantTarget, setGrantTarget] = useState<{ userId: string; name: string } | null>(null);
  const [grantAmount, setGrantAmount] = useState('10');
  const [grantReason, setGrantReason] = useState('');
  const [grantMode, setGrantMode] = useState<'give' | 'deduct'>('give');
  const [granting, setGranting] = useState(false);
  const [manageMember, setManageMember] = useState<MemberRow | null>(null);

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
          const u = await resolveMemberUser(mem.userId);
          // 舊資料在加固 rules 下可能查不到 user doc——退回 membership
          // 暱稱顯示（nameOf 會補 '?'），不讓成員整列消失。
          rows.push({
            membership: mem,
            user: u ?? ({ id: mem.userId, displayName: '' } as User),
          });
        }
        setMembers(rows);
      });
    return unsub;
  }, [family?.id]);

  const handleCreateFamily = async () => {
    if (!uid || !familyName.trim()) return;
    try {
      // R3 審查修正：建家庭改走 bootstrapParentAccount CF——守衛（ALREADY_IN_FAMILY
      // 一帳號一家庭）只在 CF 交易內，client 直寫會繞過；rules 已同步收回
      // families/familyMemberships 的 client create 許可。user doc 已存在（能進到
      // 這個畫面的前提）→ CF 不會動它，只補 family＋parent membership。
      const fn = functions().httpsCallable('bootstrapParentAccount');
      await fn({ familyName: familyName.trim() });
      setFamilyName('');
      setShowCreateFamily(false);
    } catch (e: any) {
      let msg = e?.message ?? t('family.createFailed');
      if (/ALREADY_IN_FAMILY/.test(msg)) msg = t('auth.alreadyInFamily');
      Alert.alert(t('family.createFailed'), msg);
    }
  };

  const handleInviteByEmail = async () => {
    if (!family || !inviteEmail.trim() || !inviteName.trim()) return;
    try {
      setInviting(true);
      const childName = inviteName.trim();
      const { inviteId, emailSent } = await createFamilyInvite({
        familyId: family.id,
        email: inviteEmail.trim(),
        childName,
      });
      setInviteEmail('');
      setInviteName('');
      setShowInviteEmail(false);
      // 試用期 Resend sandbox 只能寄給開發者本人 → 邀請信常常到不了。
      // 主要交付路徑改為家長手動分享邀請連結（deep link），email 只是輔助。
      const shareInviteLink = async () => {
        const message = [
          `【Mission for Kids】邀請 ${childName} 加入家庭`,
          '1. 在小孩的裝置打開 Mission for Kids App',
          '2. 點登入頁的「我有邀請連結」',
          '3. 貼上下面整段連結：',
          buildInviteLink(inviteId),
          '（連結 7 天內有效）',
        ].join('\n');
        try {
          await Share.share({ message });
        } catch {
          // 取消分享不當錯誤
        }
      };
      Alert.alert(
        '邀請已建立',
        emailSent
          ? '邀請信已寄出。最可靠的方式是直接把邀請連結分享給小孩的裝置。'
          : '寄信未成功，請直接把邀請連結分享給小孩的裝置。',
        [
          { text: '分享邀請連結', onPress: () => { void shareInviteLink(); } },
          { text: '稍後再說', style: 'cancel' },
        ]
      );
    } catch (e: any) {
      Alert.alert('邀請失敗', e?.message ?? '請重試');
    } finally {
      setInviting(false);
    }
  };

  const handleGrant = async () => {
    if (!uid || !family || !grantTarget) return;
    if (granting) return; // A9：防連點重複發點
    const raw = parseInt(grantAmount);
    if (!raw || raw <= 0) return;
    const signed = grantMode === 'deduct' ? -raw : raw;
    // A9：每次發點動作產生一把冪等鍵，網路重試/重送不會重複入帳
    const idempotencyKey = `${family.id}_${grantTarget.userId}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    setGranting(true);
    try {
      const fn = functions().httpsCallable('grantPoints');
      const res = await fn({
        childUserId: grantTarget.userId,
        familyId: family.id,
        amount: signed,
        reason:
          grantReason.trim() ||
          (grantMode === 'deduct' ? '爸媽扣點' : '爸媽直接給'),
        idempotencyKey,
      });
      // server 回傳實際變動量 delta（扣點超過餘額會被 clamp）；冪等重放拿不到 → fallback 用請求值
      const delta = (res.data as { delta?: number | null })?.delta ?? null;
      const shown = delta ?? signed;
      const adjusted = delta != null && delta !== signed;
      if (delta === 0) {
        // 扣點被 clamp 到 0（餘額已是 0）→ 給明確說明，不用「已依餘額調整」帶過
        Alert.alert('', `${grantTarget.name} 的餘額已是 0，這次沒有扣點`);
      } else {
        Alert.alert(
          '',
          `${shown > 0 ? '+' : ''}${shown} ★ → ${grantTarget.name}${
            adjusted ? '（已依餘額調整）' : ''
          }`
        );
      }
      setShowGrant(false);
      setGrantAmount('10');
      setGrantReason('');
      setGrantMode('give');
      setGrantTarget(null);
    } catch (e: any) {
      Alert.alert('錯誤', e.message || '失敗');
    } finally {
      setGranting(false);
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
              <Pressable
                key={m.membership.id}
                onPress={() => setManageMember(m)}
                style={styles.memberRow}
              >
                <View style={[styles.avatar, { backgroundColor: P.blue }]}>
                  <Label style={{ color: P.bg, fontSize: avatarOf(m) ? 20 : 14 }}>
                    {avatarOf(m) || nameOf(m)[0]?.toUpperCase() || '?'}
                  </Label>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <H3 style={{ fontSize: 15 }}>{nameOf(m)}</H3>
                  <Muted style={{ fontSize: 11, marginTop: 2 }}>家長</Muted>
                </View>
                <Muted style={{ fontSize: 18 }}>›</Muted>
              </Pressable>
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
              <Pressable
                key={m.membership.id}
                onPress={() => setManageMember(m)}
                style={styles.memberRow}
              >
                <View style={[styles.avatar, { backgroundColor: P.primary }]}>
                  <Label style={{ color: P.bg, fontSize: avatarOf(m) ? 20 : 14 }}>
                    {avatarOf(m) || nameOf(m)[0]?.toUpperCase() || '?'}
                  </Label>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <H3 style={{ fontSize: 15 }}>{nameOf(m)}</H3>
                  <Muted style={{ fontSize: 11, marginTop: 2 }}>小孩</Muted>
                </View>
                <Pressable
                  onPress={() => {
                    setGrantTarget({
                      userId: m.membership.userId,
                      name: nameOf(m),
                    });
                    setShowGrant(true);
                  }}
                  style={styles.grantPill}
                >
                  <RoughStar size={12} glow={false} />
                  <Label style={{ color: P.primary, fontSize: 11, marginLeft: 4 }}>
                    ±
                  </Label>
                </Pressable>
              </Pressable>
            ))
          )}
        </View>

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
            onPress={() => {
              Alert.alert('登出', '確定要登出嗎？', [
                { text: '取消', style: 'cancel' },
                {
                  text: '確定',
                  style: 'destructive',
                  onPress: async () => {
                    try { await auth().signOut(); } catch {}
                    router.replace('/auth/sign-in');
                  },
                },
              ]);
            }}
            style={styles.settingRow}
          >
            <Body style={{ fontSize: 14, fontWeight: '700', color: P.accentHot }}>登出</Body>
            <Muted style={{ fontSize: 13 }}>›</Muted>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => setShowInviteEmail(true)}
        style={styles.fab}
        hitSlop={10}
        accessibilityLabel="邀請小孩"
      >
        <Body style={{ color: P.bg, fontSize: 26, fontWeight: '800' }}>+</Body>
        <Body style={{ color: P.bg, fontSize: 15, fontWeight: '800' }}>邀請小孩</Body>
      </Pressable>

      {renderCreateFamilyModal()}

      {/* Invite child by email */}
      <Modal visible={showInviteEmail} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={modalStyles.overlay}>
              <View style={modalStyles.sheet}>
                <H3 style={{ marginBottom: spacing.md }}>用 Email 邀請小孩</H3>
                <TextInput
                  testID="invite-child-name"
                  style={modalStyles.input}
                  placeholder="小孩姓名"
                  placeholderTextColor={P.muted}
                  value={inviteName}
                  onChangeText={setInviteName}
                />
                <TextInput
                  testID="invite-child-email"
                  style={modalStyles.input}
                  placeholder="小孩 Email"
                  placeholderTextColor={P.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                />
                <View style={modalStyles.actions}>
                  <Pressable
                    onPress={() => setShowInviteEmail(false)}
                    style={modalStyles.cancel}
                  >
                    <Label style={{ color: P.muted }}>取消</Label>
                  </Pressable>
                  <Pressable
                    testID="invite-child-submit"
                    onPress={handleInviteByEmail}
                    disabled={inviting}
                    style={modalStyles.save}
                  >
                    <Label style={{ color: P.bg }}>送出邀請</Label>
                  </Pressable>
                </View>
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
                  {grantMode === 'deduct' ? '扣點' : '給點'} → {grantTarget?.name}
                </H3>

                <View style={modalStyles.modeRow}>
                  {(['give', 'deduct'] as const).map((mode) => {
                    const on = grantMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => setGrantMode(mode)}
                        style={[modalStyles.modeBtn, on && modalStyles.modeBtnOn]}
                      >
                        <Label
                          style={{
                            color: on ? P.bg : P.text,
                            fontSize: 13,
                            fontWeight: '700',
                          }}
                        >
                          {mode === 'give' ? '給點 +' : '扣點 −'}
                        </Label>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  style={modalStyles.input}
                  placeholder="點數"
                  placeholderTextColor={P.muted}
                  value={grantAmount}
                  onChangeText={(t) => setGrantAmount(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  autoFocus
                />
                <TextInput
                  style={modalStyles.input}
                  placeholder="原因（選填）"
                  placeholderTextColor={P.muted}
                  value={grantReason}
                  onChangeText={setGrantReason}
                />
                {grantMode === 'deduct' && (
                  <Muted style={{ fontSize: 11, marginBottom: 8 }}>
                    扣點後餘額不會低於 0
                  </Muted>
                )}
                <View style={modalStyles.actions}>
                  <Pressable
                    onPress={() => {
                      setShowGrant(false);
                      setGrantTarget(null);
                      setGrantMode('give');
                    }}
                    style={modalStyles.cancel}
                  >
                    <Label style={{ color: P.muted }}>取消</Label>
                  </Pressable>
                  <Pressable
                    onPress={handleGrant}
                    disabled={granting}
                    style={[
                      modalStyles.save,
                      grantMode === 'deduct' && { backgroundColor: P.accentHot },
                      granting && { opacity: 0.6 },
                    ]}
                  >
                    <Label style={{ color: P.bg }}>
                      {granting
                        ? '處理中…'
                        : `${grantMode === 'deduct' ? '−' : '+'}${grantAmount || '0'} ★`}
                    </Label>
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <ManageMemberModal
        member={manageMember}
        currentUid={uid}
        onClose={() => setManageMember(null)}
      />
    </SafeAreaView>
  );
}

function ManageMemberModal({
  member,
  currentUid,
  onClose,
}: {
  member: MemberRow | null;
  currentUid: string | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setNickname(member.membership.nickname || '');
      setAvatar(member.membership.avatarEmoji || null);
    }
  }, [member]);

  if (!member) return null;

  const isSelf = member.membership.userId === currentUid;
  const isChild = member.membership.role === 'child';
  // R3-3 審查修正：CF 只允許移除小孩（ONLY_CHILD_REMOVABLE），對齊政策把
  // 「移除家長」按鈕一併下架（原本 creator 看其他家長會顯示必失敗的死路按鈕）。
  // 家長互移待 co-parent 政策設計後與 CF 一起放寬。
  const canRemove = !isSelf && isChild;

  const handleSave = async () => {
    try {
      await firestore()
        .collection('familyMemberships')
        .doc(member.membership.id)
        .update({
          nickname: nickname.trim() || null,
          avatarEmoji: avatar || null,
        });
      onClose();
    } catch (e: any) {
      Alert.alert('儲存失敗', e?.message || '不明錯誤');
    }
  };

  const handleRemove = () => {
    Alert.alert(
      '移除成員',
      `確定要把「${nameOf(member)}」移出這個家庭？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '移除',
          style: 'destructive',
          onPress: async () => {
            try {
              // R3-3：移除走 CF（原子完成 membership 標 removed＋作廢 pending 邀請）。
              // rules 已禁止 client 直改 status:'removed'。
              const fn = functions().httpsCallable('removeFamilyMember');
              const res: any = await fn({
                familyId: member.membership.familyId,
                memberUserId: member.membership.userId,
              });
              onClose();
              // legacy 成員找不到 email → CF 跳過作廢邀請並回傳 warning，
              // 必須讓家長知道 pending 邀請仍有效（否則靜默留下可重新入家的邀請）。
              if (res?.data?.warning === 'NO_EMAIL_SKIP_REVOKE') {
                Alert.alert(
                  t('family.removeDoneTitle'),
                  t('family.removeInviteNotRevoked')
                );
              }
            } catch (e: any) {
              let msg = e?.message || '不明錯誤';
              if (/NOT_PARENT/.test(msg)) msg = t('family.removeNotParent');
              if (/MEMBER_NOT_FOUND/.test(msg)) msg = t('family.removeMemberNotFound');
              if (/CANNOT_REMOVE_SELF/.test(msg)) msg = t('family.removeCannotRemoveSelf');
              if (/ONLY_CHILD_REMOVABLE/.test(msg)) msg = t('family.removeOnlyChildRemovable');
              Alert.alert(t('family.removeFailed'), msg);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={!!member} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.sheet}>
              <H3 style={{ marginBottom: spacing.md }}>
                {isChild ? '小孩' : '家長'}設定
              </H3>

              <Label color={P.muted} style={{ marginBottom: 6 }}>
                暱稱（這個家庭內顯示）
              </Label>
              <TextInput
                style={modalStyles.input}
                placeholder={member.user.displayName}
                placeholderTextColor={P.muted}
                value={nickname}
                onChangeText={setNickname}
              />

              <Label color={P.muted} style={{ marginTop: 4, marginBottom: 8 }}>
                頭像
              </Label>
              <View style={modalStyles.emojiGrid}>
                <Pressable
                  onPress={() => setAvatar(null)}
                  style={[
                    modalStyles.emojiCell,
                    !avatar && modalStyles.emojiCellOn,
                  ]}
                >
                  <Label style={{ color: P.text, fontSize: 13 }}>字</Label>
                </Pressable>
                {AVATAR_EMOJIS.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => setAvatar(e)}
                    style={[
                      modalStyles.emojiCell,
                      avatar === e && modalStyles.emojiCellOn,
                    ]}
                  >
                    <Label style={{ fontSize: 20 }}>{e}</Label>
                  </Pressable>
                ))}
              </View>

              {canRemove && (
                <Pressable onPress={handleRemove} style={modalStyles.removeBtn}>
                  <Label style={{ color: P.accentHot, fontSize: 13 }}>
                    把 {nameOf(member)} 移出家庭
                  </Label>
                </Pressable>
              )}

              <View style={modalStyles.actions}>
                <Pressable onPress={onClose} style={modalStyles.cancel}>
                  <Label style={{ color: P.muted }}>取消</Label>
                </Pressable>
                <Pressable onPress={handleSave} style={modalStyles.save}>
                  <Label style={{ color: P.bg }}>儲存</Label>
                </Pressable>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
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
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.surfaceHi,
    alignItems: 'center',
  },
  modeBtnOn: {
    backgroundColor: P.primary,
    borderColor: P.primary,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  emojiCell: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: P.bg,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCellOn: {
    borderWidth: 2,
    borderColor: P.primary,
    backgroundColor: `${P.primary}33`,
  },
  removeBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
