// Day 0 계측 클라이언트. plan:208 가정 3건을 숫자로 만든다 (T3 · D22).
// 사용: node scripts/stream-probe.mjs <url> [최대초]
//   예: node scripts/stream-probe.mjs https://<배포>/api/stream-probe/node 120
//       node scripts/stream-probe.mjs https://<배포>/api/stream-probe/node?accel=off 120
//       node scripts/stream-probe.mjs https://<배포>/api/stream-probe/edge 120

const [, , url, capArg] = process.argv;
if (!url) {
  console.error('사용: node scripts/stream-probe.mjs <url> [최대초]');
  process.exit(1);
}
const capSec = Number(capArg ?? 120);

const t0 = Date.now();
const ms = () => Date.now() - t0;
const ac = new AbortController();
const capTimer = setTimeout(() => ac.abort(), capSec * 1000);

const events = []; // { event, serverT, at }
let tHeaders = null;
let resHeaders = {};
let ending = null;

try {
  const res = await fetch(url, { signal: ac.signal, headers: { accept: 'text/event-stream' } });
  tHeaders = ms();
  for (const k of [
    'content-type',
    'content-encoding',
    'transfer-encoding',
    'cache-control',
    'x-accel-buffering',
    'x-vercel-cache',
    'x-vercel-id',
    'age',
  ]) {
    const v = res.headers.get(k);
    if (v !== null) resHeaders[k] = v;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      ending = '서버가 스트림을 닫았다 (done)';
      break;
    }
    const at = ms();
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = /^event: (.*)$/m.exec(frame)?.[1] ?? 'message';
      const data = /^data: (.*)$/m.exec(frame)?.[1];
      let serverT = null;
      try {
        serverT = JSON.parse(data).t;
      } catch {}
      events.push({ event, serverT, at });
    }
  }
} catch (e) {
  ending = ac.signal.aborted ? `클라이언트가 ${capSec}초 상한에서 끊었다 (플랫폼은 안 끊었다)` : `끊김: ${e.message ?? e}`;
}
clearTimeout(capTimer);

// --- 판정
const total = ms();
const ticks = events.filter((e) => e.event === 'tick');
const first = events[0] ?? null;
// 버스트 = 서버가 1초 간격으로 보낸 이벤트가 클라에 50ms 안에 몰려 도착한 것
let burst = 0;
for (let i = 1; i < events.length; i++) {
  if (events[i].at - events[i - 1].at < 50) burst++;
}
const buffered = events.length > 2 && burst >= events.length - 2;

const out = {
  url,
  헤더도달ms: tHeaders,
  첫이벤트도달ms: first?.at ?? null,
  tick수: ticks.length,
  마지막tick서버경과s: ticks.length ? ticks[ticks.length - 1].serverT / 1000 : null,
  스트림생존s: +(total / 1000).toFixed(1),
  종료사유: ending,
  버퍼링판정: buffered ? 'BUFFERED — 이벤트가 몰려서 도착했다' : 'STREAMED — 이벤트가 하나씩 도착했다',
  응답헤더: resHeaders,
};

console.log('');
for (const [k, v] of Object.entries(out)) {
  if (k === '응답헤더') continue;
  console.log(`  ${k.padEnd(20)} ${v}`);
}
console.log('  응답헤더');
for (const [k, v] of Object.entries(resHeaders)) console.log(`    ${k}: ${v}`);
console.log('');
console.log('  도착 간격 (앞 5 · 뒤 5, 클라 경과ms ← 서버 경과ms)');
const show = events.length <= 10 ? events : [...events.slice(0, 5), null, ...events.slice(-5)];
for (const e of show) console.log(e ? `    ${String(e.at).padStart(7)} ← ${e.serverT}` : '       ...');
console.log('');
console.log('JSON ' + JSON.stringify(out));
