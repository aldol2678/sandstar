const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'affinity.js'), 'utf8') +
  '\n;({normalize:ssAffinityNormalize, gain:ssAffinityGain, day:ssAffinityDay})');
const day = '2026-11-28', next = '2026-11-29';

test('old saves start with seven separate residents, valid points survive reloading', () => {
  const s = rules.normalize();
  assert.equal(Object.keys(s.npc).length, 7);
  const a = rules.gain(s, 'sola', 'talk', day);
  assert.equal(a.npc.sola.points, 6);
  assert.equal(a.npc.harin.points, 0);
  assert.equal(s.npc.sola.points, 0);
  assert.equal(rules.gain(rules.normalize(JSON.parse(JSON.stringify(a))), 'sola', 'talk', day), null);
  const future = {v:2,npc:{},newField:7};
  assert.equal(rules.normalize(future), future);
  assert.equal(rules.gain(future, 'sola', 'talk', day), null);
});

test('the game day rolls at 05:00 KST and earlier days never add points', () => {
  assert.equal(rules.day(Date.parse('2026-11-28T04:59:59+09:00')), '2026-11-27');
  assert.equal(rules.day(Date.parse('2026-11-28T05:00:00+09:00')), day);
  const a = rules.gain(rules.normalize(), 'sola', 'talk', day);
  const b = rules.gain(a, 'sola', 'talk', next);
  assert.equal(b.npc.sola.points, 12);
  assert.equal(rules.gain(b, 'maru', 'talk', day), null);
});

test('the three suppliers share ten daily points, with a new allowance the following day', () => {
  let s = rules.normalize();
  for (const id of ['harin','sola','yeoul','harin','sola']) s = rules.gain(s,id,'delivery',day);
  assert.equal(s.deliveryPoints, 10);
  assert.equal(rules.gain(s,'yeoul','delivery',day), null);
  assert.equal(rules.gain(s,'yeoul','talk',day).npc.yeoul.points, 8);
  const later = rules.gain(s,'yeoul','delivery',next);
  assert.equal(later.deliveryPoints, 2);
  assert.equal(later.npc.yeoul.points, 4);
});

test('each threshold unlocks once, awards two tickets, and honours both caps', () => {
  for (const [level, threshold] of [[2,30],[3,70],[4,120],[5,180]]) {
    const s = rules.normalize({v:1,npc:{maru:{points:threshold-1}}});
    const a = rules.gain(s,'maru','talk',day);
    assert.equal(a.npc.maru.level,level);
    assert.equal(a.tickets,2);
    assert.equal(rules.gain(a,'maru','talk',day),null);
    if (level === 5) {
      assert.equal(a.npc.maru.points,180);
      assert.equal(rules.gain(a,'maru','talk',next),null);
    }
  }
  const s = rules.normalize({v:1,tickets:29,npc:{tobak:{points:29}}});
  assert.equal(rules.gain(s, 'tobak', 'talk', day).tickets, 30);
});
