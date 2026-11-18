import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, Modal,
  Share, Switch, StyleSheet, useColorScheme, StatusBar, Platform, useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'ovms.v1';
const IDLE = 10 * 60 * 1000;
const sha = (t) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, t);
const fmt = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const dur = (a, b) => { const m = Math.round(((b || Date.now()) - a) / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

const light = { bg: '#eef1f4', card: '#ffffff', ink: '#17212b', mut: '#5d6b78', line: '#d5dce3', acc: '#0b6e66', accInk: '#ffffff', soft: '#dff1ee', bad: '#b3261e' };
const dark = { bg: '#10171d', card: '#18222b', ink: '#e6edf3', mut: '#93a2b0', line: '#2b3946', acc: '#4cc2b4', accInk: '#08201d', soft: '#173532', bad: '#ff8a80' };

async function seed() {
  const h = Date.now(), H = 3600000;
  return {
    users: [
      { id: 1, name: 'Alma Reyes', username: 'admin', pw: await sha('admin123'), role: 'admin', active: true },
      { id: 2, name: 'Ben Santos', username: 'frontdesk', pw: await sha('desk123'), role: 'staff', active: true },
    ],
    visits: [
      { id: 1, badge: 'V-001', name: 'Carlo Mendoza', contact: '0917 555 0142', purpose: 'Submit documents', host: 'Records Section', tin: h - 5 * H, tout: h - 4.5 * H, by: 'frontdesk' },
      { id: 2, badge: 'V-002', name: 'Jenny Dela Cruz', contact: '0928 555 0177', purpose: 'Meeting with director', host: 'Office of the Director', tin: h - 2 * H, tout: null, by: 'frontdesk' },
      { id: 3, badge: 'V-003', name: 'Mark Villanueva', contact: '0999 555 0108', purpose: 'Delivery', host: 'Supply Office', tin: h - 0.7 * H, tout: null, by: 'frontdesk' },
    ],
    logs: [], seq: 4,
  };
}

function Main() {
  const c = useColorScheme() === 'dark' ? dark : light;
  const s = useMemo(() => mk(c), [c]);
  const [S, setS] = useState(null);
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('');
  const [note, setNote] = useState(null);
  const [q, setQ] = useState('');
  const [showArch, setShowArch] = useState(false);
  const [rep, setRep] = useState('day');
  const [edit, setEdit] = useState(null);
  const idle = useRef(null);
  const wide = useWindowDimensions().width >= 900;
  const grid = wide ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' } : null;
  const half = wide ? { width: '49%' } : null;

  useEffect(() => {
    (async () => {
      let d = null;
      try { const r = await AsyncStorage.getItem(KEY); d = r ? JSON.parse(r) : null; } catch (e) {}
      setS(d || (await seed()));
    })();
  }, []);
  useEffect(() => { if (S) AsyncStorage.setItem(KEY, JSON.stringify(S)).catch(() => {}); }, [S]);

  const bump = () => {
    clearTimeout(idle.current);
    if (me) idle.current = setTimeout(() => logout('Signed out after 10 minutes of inactivity.'), IDLE);
  };
  useEffect(bump, [me]);

  if (!S) return <SafeAreaView style={s.root}><Text style={s.mut}>Loading…</Text></SafeAreaView>;

  const logEv = (a, user = me) => setS((p) => ({ ...p, logs: [{ t: Date.now(), u: user ? user.username : 'system', a }, ...p.logs].slice(0, 300) }));
  const logout = (m) => { if (me) logEv('Signed out'); setMe(null); setNote(m ? { t: m } : null); };
  const live = S.visits.filter((v) => !v.arch);
  const inside = live.filter((v) => !v.tout);
  const adm = me && me.role === 'admin';

  const timeOut = (id) => {
    const v = S.visits.find((x) => x.id === id);
    setS((p) => ({ ...p, visits: p.visits.map((x) => (x.id === id ? { ...x, tout: Date.now() } : x)) }));
    logEv(`Time-out recorded for ${v.name} (${v.badge})`);
    setNote({ t: `${v.name} is checked out.` });
  };
  const archive = (id) => {
    const v = S.visits.find((x) => x.id === id);
    setS((p) => ({ ...p, visits: p.visits.map((x) => (x.id === id ? { ...x, arch: !x.arch } : x)) }));
    logEv(`${v.arch ? 'Restored' : 'Archived'} ${v.badge}`);
  };

  // ---------- screens ----------
  if (!me) return <Login s={s} c={c} S={S} note={note} onIn={(u) => { setMe(u); setTab(u.role === 'admin' ? 'Dashboard' : 'Register'); setNote(null); logEv('Signed in', u); }} setNote={setNote} />;

  const tabs = adm ? ['Dashboard', 'Inside now', 'Records', 'Reports', 'Staff', 'Activity'] : ['Register', 'Inside now', 'Records'];
  const filtered = (adm && showArch ? S.visits : live).filter((v) => {
    const t = q.toLowerCase();
    return !t || `${v.name} ${v.badge} ${v.host} ${v.purpose} ${fmt(v.tin)}`.toLowerCase().includes(t);
  });
  const since = rep === 'day' ? startOfDay(Date.now()) : startOfDay(Date.now()) - (rep === 'week' ? 6 : 29) * 864e5;
  const period = live.filter((v) => v.tin >= since);
  const done = period.filter((v) => v.tout);
  const avg = done.length ? Math.round(done.reduce((a, v) => a + v.tout - v.tin, 0) / done.length / 60000) : 0;

  const csv = () => {
    const rows = [['Badge', 'Name', 'Contact', 'Purpose', 'Host', 'Time in', 'Time out'], ...period.map((v) => [v.badge, v.name, v.contact, v.purpose, v.host, new Date(v.tin).toISOString(), v.tout ? new Date(v.tout).toISOString() : ''])];
    Share.share({ title: 'Visitor report', message: rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n') });
  };

  const Visit = ({ v, out, manage }) => (
    <View style={[s.card, half]}>
      <View style={s.rowBetween}>
        <Text style={s.h3}>{v.name}</Text>
        <Tag s={s} on={!v.tout} text={v.tout ? 'Left' : 'Inside'} />
      </View>
      <Text style={s.mut}>{v.badge} · {v.contact}</Text>
      <Text style={s.body}>{v.host} — {v.purpose}</Text>
      <Text style={s.mut}>In {fmt(v.tin)}  ·  Out {fmt(v.tout)}{!v.tout ? `  ·  ${dur(v.tin)} on site` : ''}{v.arch ? '  ·  archived' : ''}</Text>
      <View style={s.actions}>
        {out && !v.tout ? <Btn s={s} t="Record time-out" p onPress={() => timeOut(v.id)} /> : null}
        {manage ? <><Btn s={s} t="Edit" onPress={() => setEdit({ ...v })} /><Btn s={s} t={v.arch ? 'Restore' : 'Archive'} onPress={() => archive(v.id)} /></> : null}
      </View>
    </View>
  );
  const Empty = ({ t }) => <Text style={[s.mut, { textAlign: 'center', padding: 24 }]}>{t}</Text>;

  let body = null;
  if (tab === 'Register') body = <Register s={s} onSave={(f) => {
    const id = S.seq, v = { id, badge: `V-${String(id).padStart(3, '0')}`, ...f, tin: Date.now(), tout: null, by: me.username };
    setS((p) => ({ ...p, visits: [v, ...p.visits], seq: p.seq + 1 }));
    logEv(`Registered ${v.name} (${v.badge})`);
    setNote({ t: `${v.name} is checked in. Badge ${v.badge}.` });
  }} setNote={setNote} />;
  if (tab === 'Dashboard') {
    const today = live.filter((v) => v.tin >= startOfDay(Date.now()));
    body = <>
      <View style={s.stats}>{[[live.length, 'Total on record'], [inside.length, 'Inside now'], [today.length, 'Today']].map(([n, l]) => <View key={l} style={[s.card, s.stat]}><Text style={s.big}>{n}</Text><Text style={s.mut}>{l}</Text></View>)}</View>
      <Text style={s.h2}>Today's visitors</Text>
      <View style={grid}>{today.length ? today.map((v) => <Visit key={v.id} v={v} />) : <Empty t="No visitors yet today." />}</View>
    </>;
  }
  if (tab === 'Inside now') body = <>
    <Text style={s.h2}>Inside now ({inside.length})</Text>
    <View style={grid}>{inside.length ? inside.map((v) => <Visit key={v.id} v={v} out />) : <Empty t="Nobody is inside right now." />}</View>
  </>;
  if (tab === 'Records') body = <>
    <TextInput style={s.input} placeholder="Search by name, badge, or date" placeholderTextColor={c.mut} value={q} onChangeText={setQ} />
    {adm ? <View style={[s.rowBetween, { marginTop: 4, marginBottom: 14 }]}><Text style={s.mut}>Show archived</Text><Switch value={showArch} onValueChange={setShowArch} /></View> : null}
    <View style={grid}>{filtered.length ? filtered.map((v) => <Visit key={v.id} v={v} manage={adm} />) : <Empty t="No records match." />}</View>
  </>;
  if (tab === 'Reports') body = <>
    <View style={s.actions}>{[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']].map(([k, l]) => <Btn key={k} s={s} t={l} p={rep === k} onPress={() => setRep(k)} />)}</View>
    <Text style={[s.body, { marginTop: 14, marginBottom: 12 }]}>{period.length} visitors · {period.filter((v) => !v.tout).length} still inside · average stay {avg} min</Text>
    <View style={{ alignSelf: 'flex-start', marginBottom: 16 }}><Btn s={s} t="Share report as CSV" onPress={csv} /></View>
    <View style={grid}>{period.map((v) => <Visit key={v.id} v={v} />)}</View>
  </>;
  if (tab === 'Staff') body = <Staff s={s} S={S} me={me} setNote={setNote}
    onToggle={(id) => { const u = S.users.find((x) => x.id === id); setS((p) => ({ ...p, users: p.users.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) })); logEv(`${u.active ? 'Disabled' : 'Enabled'} ${u.username}`); }}
    onAdd={async (f) => {
      const username = f.username.trim().toLowerCase();
      if (S.users.some((x) => x.username === username)) return setNote({ e: 1, t: 'That username is taken.' });
      const u = { id: S.seq, name: f.name.trim(), username, pw: await sha(f.pw), role: f.role, active: true };
      setS((p) => ({ ...p, users: [...p.users, u], seq: p.seq + 1 }));
      logEv(`Created account ${username}`); setNote({ t: 'Account created.' }); return true;
    }} />;
  if (tab === 'Activity') body = <>
    <Text style={s.h2}>Activity log</Text>
    {S.logs.length ? S.logs.map((l, i) => <View key={i} style={s.card}><Text style={s.body}>{l.a}</Text><Text style={s.mut}>{fmt(l.t)} · {l.u}</Text></View>) : <Empty t="No activity yet." />}
  </>;

  return (
    <SafeAreaView style={s.root} onStartShouldSetResponderCapture={() => { bump(); return false; }}>
      <StatusBar barStyle={c === dark ? 'light-content' : 'dark-content'} />
      <View style={s.header}>
        <View style={{ flex: 1 }}><Text style={s.h2}>Visitor Management</Text><Text style={s.mut}>{me.name} · {adm ? 'Administrator' : 'Office staff'}</Text></View>
        <Btn s={s} t="Sign out" onPress={() => logout()} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {tabs.map((t) => (
          <TouchableOpacity key={t} onPress={() => { setTab(t); setQ(''); setNote(null); }} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={[s.tab, tab === t && s.tabOn]}>
            <Text style={[s.tabTxt, tab === t && { color: c.ink, fontWeight: '700' }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Note s={s} note={note} />
        {body}
      </ScrollView>
      <Modal visible={!!edit} animationType="slide" transparent onRequestClose={() => setEdit(null)}>
        <View style={s.modalBg}><View style={[s.card, { margin: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }]}>
          <Text style={s.h2}>Edit {edit && edit.badge}</Text>
          {edit && [['name', 'Name'], ['contact', 'Contact number'], ['purpose', 'Purpose'], ['host', 'Person or department']].map(([k, l]) => (
            <Field key={k} s={s} label={l} value={edit[k]} onChangeText={(t) => setEdit({ ...edit, [k]: t })} />
          ))}
          <View style={s.actions}>
            <Btn s={s} t="Cancel" onPress={() => setEdit(null)} />
            <Btn s={s} t="Save changes" p onPress={() => {
              setS((p) => ({ ...p, visits: p.visits.map((x) => (x.id === edit.id ? { ...x, name: edit.name.trim(), contact: edit.contact.trim(), purpose: edit.purpose.trim(), host: edit.host.trim() } : x)) }));
              logEv(`Edited record ${edit.badge}`); setEdit(null); setNote({ t: 'Record updated.' });
            }} />
          </View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  const c = useColorScheme() === 'dark' ? dark : light;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: c.bg }}>
      <Main />
    </View>
  );
}

// ---------- small components ----------
const Btn = ({ s, t, p, onPress }) => (
  <TouchableOpacity onPress={onPress} accessibilityRole="button" style={[s.btn, p && s.btnP]}><Text style={[s.btnTxt, p && s.btnTxtP]}>{t}</Text></TouchableOpacity>
);
const Tag = ({ s, on, text }) => <View style={[s.tag, !on && s.tagOff]}><Text style={[s.tagTxt, !on && { color: s.mut.color }]}>{text}</Text></View>;
const Note = ({ s, note }) => (note ? <View style={[s.note, note.e && s.noteE]} accessibilityLiveRegion="polite"><Text style={[s.body, note.e && { color: s.bad.color }]}>{note.t}</Text></View> : null);
const Field = ({ s, label, ...p }) => (
  <View style={{ marginTop: 12 }}><Text style={s.label}>{label}</Text><TextInput style={s.input} placeholderTextColor={s.mut.color} {...p} /></View>
);

function Login({ s, S, note, onIn, setNote }) {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const go = async () => {
    const h = await sha(p);
    const usr = S.users.find((x) => x.username === u.trim().toLowerCase() && x.pw === h && x.active);
    if (!usr) return setNote({ e: 1, t: 'Wrong username or password, or the account is disabled.' });
    onIn(usr);
  };
  return (
    <SafeAreaView style={[s.root, { justifyContent: 'center', padding: 20 }]}>
      <View style={[s.card, { maxWidth: 440, width: '100%', alignSelf: 'center' }]}>
        <Text style={s.h1}>Office Visitor Management</Text>
        <Text style={s.mut}>Sign in to register and monitor visitors.</Text>
        <Note s={s} note={note} />
        <Field s={s} label="Username" value={u} onChangeText={setU} autoCapitalize="none" autoCorrect={false} />
        <Field s={s} label="Password" value={p} onChangeText={setP} secureTextEntry onSubmitEditing={go} />
        <View style={{ height: 16 }} /><Btn s={s} t="Sign in" p onPress={go} />
        <Text style={[s.mut, { marginTop: 14 }]}>Demo: admin / admin123 · frontdesk / desk123</Text>
      </View>
    </SafeAreaView>
  );
}

function Register({ s, onSave, setNote }) {
  const empty = { name: '', contact: '', purpose: '', host: '' };
  const [f, setF] = useState(empty);
  const set = (k) => (t) => setF({ ...f, [k]: t });
  return (
    <View style={[s.card, { maxWidth: 640, width: '100%' }]}>
      <Text style={s.h2}>Register a visitor</Text>
      <Text style={s.mut}>Time-in is recorded automatically when you save.</Text>
      <Field s={s} label="Visitor name" value={f.name} onChangeText={set('name')} />
      <Field s={s} label="Contact number" value={f.contact} onChangeText={set('contact')} keyboardType="phone-pad" />
      <Field s={s} label="Purpose of visit" value={f.purpose} onChangeText={set('purpose')} />
      <Field s={s} label="Person or department to visit" value={f.host} onChangeText={set('host')} />
      <View style={{ height: 16 }} />
      <Btn s={s} t="Check in visitor" p onPress={() => {
        if (Object.values(f).some((x) => !x.trim())) return setNote({ e: 1, t: 'Fill in every field.' });
        onSave({ name: f.name.trim(), contact: f.contact.trim(), purpose: f.purpose.trim(), host: f.host.trim() }); setF(empty);
      }} />
    </View>
  );
}

function Staff({ s, S, me, onToggle, onAdd, setNote }) {
  const empty = { name: '', username: '', pw: '', role: 'staff' };
  const [f, setF] = useState(empty);
  return (
    <>
      <Text style={s.h2}>Staff accounts</Text>
      {S.users.map((u) => (
        <View key={u.id} style={s.card}>
          <View style={s.rowBetween}><Text style={s.h3}>{u.name}</Text><Tag s={s} on={u.active} text={u.active ? 'Active' : 'Disabled'} /></View>
          <Text style={s.mut}>{u.username} · {u.role}</Text>
          {u.id !== me.id ? <View style={s.actions}><Btn s={s} t={u.active ? 'Disable' : 'Enable'} onPress={() => onToggle(u.id)} /></View> : null}
        </View>
      ))}
      <View style={s.card}>
        <Text style={s.h2}>Add staff account</Text>
        <Field s={s} label="Full name" value={f.name} onChangeText={(t) => setF({ ...f, name: t })} />
        <Field s={s} label="Username" value={f.username} onChangeText={(t) => setF({ ...f, username: t })} autoCapitalize="none" />
        <Field s={s} label="Password (8+ characters)" value={f.pw} onChangeText={(t) => setF({ ...f, pw: t })} secureTextEntry />
        <View style={[s.actions, { marginTop: 12 }]}>
          <Btn s={s} t="Office staff" p={f.role === 'staff'} onPress={() => setF({ ...f, role: 'staff' })} />
          <Btn s={s} t="Administrator" p={f.role === 'admin'} onPress={() => setF({ ...f, role: 'admin' })} />
        </View>
        <View style={{ height: 12 }} />
        <Btn s={s} t="Create account" p onPress={async () => {
          if (!f.name.trim() || !f.username.trim() || f.pw.length < 8) return setNote({ e: 1, t: 'Enter a name, a username, and a password of 8+ characters.' });
          if (await onAdd(f)) setF(empty);
        }} />
      </View>
    </>
  );
}

const mk = (c) => StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: 1100, backgroundColor: c.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.line },
  tabs: { flexGrow: 0, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.line },
  tab: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: c.acc },
  tabTxt: { color: c.mut, fontSize: 15 },
  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 16, marginBottom: 12 },
  h1: { color: c.ink, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  h2: { color: c.ink, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  h3: { color: c.ink, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  body: { color: c.ink, fontSize: 15, marginVertical: 4 },
  mut: { color: c.mut, fontSize: 13, marginVertical: 2 },
  bad: { color: c.bad },
  label: { color: c.ink, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: c.line, borderRadius: 8, backgroundColor: c.bg, color: c.ink, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 8 },
  btn: { borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  btnP: { backgroundColor: c.acc, borderColor: c.acc },
  btnTxt: { color: c.ink, fontWeight: '600', textAlign: 'center' },
  btnTxtP: { color: c.accInk },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tag: { backgroundColor: c.soft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  tagOff: { backgroundColor: c.bg },
  tagTxt: { color: c.acc, fontSize: 12, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 12 },
  big: { color: c.acc, fontSize: 30, fontWeight: '800' },
  note: { backgroundColor: c.soft, borderRadius: 8, padding: 10, marginBottom: 12 },
  noteE: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.bad },
  modalBg: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
});