const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const rules = vm.runInNewContext(['residents.js','chapter-one.js','affinity.js'].map(file => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n') +
  '\n;({normalize:ssAffinityNormalize, gain:ssAffinityGain, day:ssAffinityDay, week:ssAffinityWeek, profiles:SS_AFFINITY_RESIDENTS, topics:ssChapterTopics, links:ssChapterConnections, voices:SS_CHAPTER_ONE_VOICES})');
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

test('each resident has two distinct responses, tastes, and persistent scene choices', () => {
  for (const [id, profile] of Object.entries(rules.profiles)) {
    const items = Object.keys(profile.gifts);
    assert.equal(items.length, 2);
    assert.ok(items.includes(profile.favorite));
    assert.equal(new Set(profile.choices.map(c => c.id)).size, 2);
    assert.equal(new Set(profile.choices.map(c => c.recall)).size, 2);
    for (const item of items) {
      const initial = rules.normalize();
      const next = rules.gain(initial,id,'gift',day,item);
      assert.equal(next.npc[id].points, item === profile.favorite ? 10 : 4);
      assert.equal(next.npc[id].tastes.join(','),item);
      assert.equal(rules.gain(next,id,'gift',day,item),null);
      assert.equal(initial.npc[id].tastes.length,0);
    }
    assert.equal(rules.gain(rules.normalize(),id,'gift',day,'not-a-gift'),null);
  }
});

test('gift weeks reset Monday 05:00 in Korea, including across a year boundary', () => {
  const early = rules.day(Date.parse('2027-01-04T04:59:59+09:00'));
  const late = rules.day(Date.parse('2027-01-04T05:00:00+09:00'));
  assert.equal(rules.week(early),'2026-12-28');
  assert.equal(rules.week(late),'2027-01-04');
  const given = rules.gain(rules.normalize(),'yeoul','gift',early,'carp');
  const next = rules.gain(given,'yeoul','gift',late,'perch');
  assert.equal(next.npc.yeoul.tastes.join(','),'carp,perch');
  assert.equal(rules.gain(next,'harin','gift',early,'bread'),null);
  assert.equal(rules.gain(next,'sola','gift',late,'wheat').npc.sola.points,4);
});

test('a gift at max friendship still records taste and never re-awards milestone tickets', () => {
  const old = rules.normalize({v:1,tickets:5,npc:{maru:{points:180,claimed:[2,3,4,5]}}});
  const next = rules.gain(old,'maru','gift',day,'stew');
  assert.equal(next.tickets,5);
  assert.equal(next.npc.maru.points,180);
  assert.equal(next.npc.maru.tastes[0],'stew');
  assert.equal(next.npc.maru.claimed.length,4);
});

test('loading a previous friendship save preserves points and sanitizes unknown story choices', () => {
  const world = rules.normalize({v:1,tickets:9,npc:{sola:{points:72,memory:'bad',recalled:true,tastes:['junk','wheat','wheat']}}});
  assert.equal(world.npc.sola.level,3);
  assert.equal(world.npc.sola.memory,'');
  assert.equal(world.npc.sola.recalled,false);
  assert.equal(world.npc.sola.tastes.join(','),'wheat');
  assert.equal(world.tickets,9);
});

test('chapter topics follow each documented world flag independently', () => {
  const keys = ['crystalSeen','forestVisited','springRepaired'];
  for (let mask = 0; mask < 8; mask++) {
    const want = keys.filter((_, index) => mask & (1 << index));
    const story = Object.fromEntries(want.map(key => [key,true]));
    assert.deepEqual(Array.from(rules.topics(story), t => t.key), want);
  }
  assert.equal(rules.topics({crystalSeen:'true'}).length,0);
});

test('saved testimony migrates independently and reveals a joint note only after every witness is heard', () => {
  const affinity = rules.normalize({v:1,npc:{sola:{points:76,memory:'nickname',chapterHeard:['forestVisited','other','forestVisited']}}});
  assert.deepEqual(Array.from(affinity.npc.sola.chapterHeard),['forestVisited']);
  assert.equal(affinity.npc.sola.memory,'nickname');
  assert.equal(affinity.npc.sola.points,76);
  assert.equal(affinity.npc.harin.chapterHeard.length,0);
  const world = {affinity, storyM1:{}};
  for (const [key, residents] of [
    ['forestVisited',['yeoul','sola']], ['crystalSeen',['maru','tobak','gaengi']], ['springRepaired',['harin','seoon']]
  ]) {
    world.storyM1[key] = true;
    for (const id of residents.filter(id => !world.affinity.npc[id].chapterHeard.includes(key))) {
      assert.ok(!rules.links(world).some(link => link.key === key));
      affinity.npc[id].chapterHeard.push(key);
    }
    assert.equal(rules.links(world).filter(link => link.key === key).length,1);
    world.storyM1[key] = false;
    assert.ok(!rules.links(world).some(link => link.key === key));
  }
});

test('each resident has three short chapter reactions and a matching callback for either scene choice', () => {
  const stories = ['arrival','crystalSeen','forestVisited','springRepaired'];
  assert.deepEqual(Object.keys(rules.voices).sort(),Object.keys(rules.profiles).sort());
  for (const [id, profile] of Object.entries(rules.profiles)) {
    const voice = rules.voices[id];
    assert.deepEqual(Object.keys(voice.personal).sort(),Array.from(profile.choices,c => c.id).sort());
    assert.equal(new Set(Object.values(voice.personal)).size,2);
    for (const line of [...stories.map(key => voice[key]),...Object.values(voice.personal)])
      assert.ok(line.length > 0 && [...line].length <= 30, id + ' ' + line);
  }
});

test('recorded v4 lines cover the resident scripts and both answers of every scene', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,'../../assets/npc-voices-v4/manifest.json'),'utf8'));
  assert.equal(manifest.model_id,'eleven_v4');
  const extra = {
    yeoul:['전에 네 도감으로 짚은 물길, 그 표식부터 다시 보자.'],
    harin:['수문턱에 금을 그었어. 다음 물높이도 같이 재자.','광산 X55에서 묘한 빛이 보여. 근처 땅을 조금 캐보고 살펴줄래?']
  };
  for (const [id,profile] of Object.entries(rules.profiles)) {
    const voice=rules.voices[id];
    const expected=[voice.arrival,voice.crystalSeen,voice.forestVisited,voice.springRepaired,...Object.values(voice.personal),
      profile.hint.slice(1,-1),...Object.values(profile.gifts),...profile.choices.flatMap(c=>[c.reply,c.recall]),...(extra[id] || [])];
    const takes=manifest.clips.filter(c=>c.npc===id);
    assert.deepEqual(takes.map(c=>c.line).sort(),expected.sort());
    assert.equal(new Set(takes.map(c=>c.key)).size,takes.length);
  }
  assert.equal(new Set(manifest.clips.map(c=>c.generation_id)).size,manifest.clips.length);
});
