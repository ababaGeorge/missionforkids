import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { TaskInstance } from '../../../types/models';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import { Display, H3, Label, Muted, Data } from '../../../design/Text';
import { Empty } from '../../../design/Empty';

type NotifKind = 'approved' | 'redo';

type NotifItem = {
  id: string;
  kind: NotifKind;
  title: string;
  points: number | null;
  reviewedAt: any;
};

const KIND_CONFIG: Record<NotifKind, { symbol: string; color: string }> = {
  approved: { symbol: '✓', color: P.green },
  redo: { symbol: '↻', color: P.accent },
};

const fmtTime = (ts: any): string => {
  if (!ts) return '';
  const d: Date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return d.toLocaleDateString();
};

export default function ChildNotif() {
  const uid = auth().currentUser?.uid;
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const snapshotGen = useRef(0);

  useEffect(() => {
    if (!uid) return;
    const unsub = firestore()
      .collection('familyMemberships')
      .where('userId', '==', uid)
      .where('status', '==', 'active')
      .limit(1)
      .onSnapshot((snap) => {
        if (!snap) return;
        if (!snap.empty) setFamilyId(snap.docs[0].data().familyId);
      }, (err) => console.error('[Notif] membership error:', (err as any)?.code));
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid || !familyId) return;
    const unsub = firestore()
      .collection('taskInstances')
      .where('userId', '==', uid)
      .where('familyId', '==', familyId)
      .where('status', 'in', ['approved', 'rejected'])
      .limit(20)
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const gen = ++snapshotGen.current;
        const items: NotifItem[] = [];
        for (const doc of snap.docs) {
          try {
            const inst = { id: doc.id, ...doc.data() } as TaskInstance;
            const taskDoc = await firestore().collection('tasks').doc(inst.taskId).get();
            const taskTitle = taskDoc.data()?.title || '任務';
            items.push({
              id: doc.id,
              kind: inst.status === 'approved' ? 'approved' : 'redo',
              title: taskTitle,
              points: inst.pointsAwarded,
              reviewedAt: inst.reviewedAt,
            });
          } catch (e) {
            console.warn('[Notif] skipping', doc.id, (e as any)?.code);
          }
        }
        if (gen !== snapshotGen.current) return;
        items.sort((a, b) => {
          const da: any = a.reviewedAt?.toDate?.() ?? new Date(a.reviewedAt ?? 0);
          const db: any = b.reviewedAt?.toDate?.() ?? new Date(b.reviewedAt ?? 0);
          return db.getTime() - da.getTime();
        });
        setNotifs(items);
      }, (err) => console.error('[Notif] snapshot error:', (err as any)?.code));
    return unsub;
  }, [uid, familyId]);

  const unreadCount = notifs.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = () => {
    setReadIds(new Set(notifs.map((n) => n.id)));
  };

  const markOneRead = (id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Starfield count={18} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Label color={P.muted} style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>
              通知
            </Label>
            <Display style={{ marginTop: 2 }}>今天的消息</Display>
          </View>
          {unreadCount > 0 && (
            <Pressable onPress={markAllRead} style={styles.markReadBtn}>
              <Muted style={{ fontSize: 12 }}>全部標示已讀</Muted>
            </Pressable>
          )}
        </View>

        <View style={styles.body}>
          {notifs.length === 0 ? (
            <Empty emoji="◐" title="還沒有通知" body="爸媽批准任務或獎勵時，會在這裡通知你。" />
          ) : (
            notifs.map((n) => {
              const isRead = readIds.has(n.id);
              const cfg = KIND_CONFIG[n.kind];
              return (
                <Pressable
                  key={n.id}
                  onPress={() => markOneRead(n.id)}
                  style={[styles.notifCard, isRead && styles.notifCardRead]}
                >
                  {!isRead && <View style={styles.unreadDot} />}
                  <View style={[styles.iconCircle, { backgroundColor: `${cfg.color}22` }]}>
                    <Data style={{ color: cfg.color, fontSize: 16, fontWeight: '700' }}>
                      {cfg.symbol}
                    </Data>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                    <H3 style={{ fontSize: 14, fontWeight: '700', lineHeight: 18 }}>
                      {n.kind === 'approved'
                        ? `媽媽通過了「${n.title}」✓`
                        : `「${n.title}」再試一次`}
                    </H3>
                    <View style={styles.metaRow}>
                      <Muted style={{ fontSize: 11 }}>{fmtTime(n.reviewedAt)}</Muted>
                    </View>
                  </View>
                  {n.kind === 'approved' && n.points != null && (
                    <Data style={{ fontSize: 13, color: P.primary, marginLeft: 8, fontWeight: '800' }}>
                      +{n.points}
                    </Data>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  scroll: { paddingBottom: spacing['3xl'] + spacing.lg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  markReadBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  body: { paddingHorizontal: spacing.lg },
  notifCard: {
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  notifCardRead: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: P.primary,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
});
