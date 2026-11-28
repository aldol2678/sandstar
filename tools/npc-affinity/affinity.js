// World-save relationship data. The reset is 05:00 in Korea (20:00 UTC).
const SS_AFFINITY_THRESHOLDS = [0, 30, 70, 120, 180];
const SS_AFFINITY_LEVELS = ['첫인사', '낯익은 사이', '친한 이웃', '믿는 사이', '오랜 벗'];
const SS_AFFINITY_DELIVERIES = {
  'npc:carpenter': 'harin', 'npc:farmer': 'sola', 'npc:fisher': 'yeoul'
};

// These short notebook entries unlock separately from the original voiced dialogue.
const SS_AFFINITY_NOTES = {
  harin: ['하린이 내 손에 맞는 망치 자루를 골라 주었다.', '수리한 집 문틀에 둘이 키를 재고 연필금을 그었다.', '하린은 새로 단 문이 잘 닫히는지 내게 먼저 물었다.', '빈집에 불이 들어왔다. 하린이 나를 첫 손님으로 불렀다.'],
  sola: ['솔아가 내 손바닥에 밀 씨앗을 놓고 결을 보여 주었다.', '밭일을 마치고 둘이 흙 묻은 손으로 관찰 일지를 넘겼다.', '솔아가 반딧불나무 그늘에 내 자리를 비워 두었다.', '올해 첫 이삭을 발견한 사람으로 내 이름도 일지에 남았다.'],
  yeoul: ['여울과 돌을 하나씩 던져 물결이 퍼지는 쪽을 맞혔다.', '둘이 강가에 앉아 물살 소리만 듣고 저녁을 보냈다.', '여울은 물빛이 달라지면 나부터 불러 준다.', '강가에 나란히 앉았다. 오늘은 여울이 먼저 내 이야기를 기다렸다.'],
  seoon: ['서온이 수정에 비스듬히 빛을 비추는 법을 보여 주었다.', '서온의 표본 꼬리표에 내가 주운 자리도 적혔다.', '아직 설명이 안 되는 별맥 기록을 둘이 같이 펼쳐 보았다.', '서온이 조사 일지 첫 장에 내 이름을 나란히 적었다.'],
  maru: ['마루가 장터를 한 바퀴 돌며 단골들의 이름을 알려 주었다.', '장이 파한 뒤 마루와 못생긴 당근을 반씩 나눠 먹었다.', '마루가 자리를 비우며 잠깐 가게를 봐 달라고 했다.', '마루가 좌판 뒤 의자를 하나 더 놨다. 내 자리라고 한다.'],
  tobak: ['토박이 망치질을 멈추고 쇠가 식는 소리를 들려주었다.', '대장간 한구석에 내 키에 맞춘 앞치마가 걸렸다.', '토박이 처음 벼렸던 휘어진 못을 손에 쥐여 주었다.', '불을 끌 무렵 토박이 찻잔 두 개를 꺼냈다.'],
  gaengi: ['갱이가 오래된 헬멧의 흠집 하나를 짚으며 한참을 웃었다.', '갱이가 갱도에서 쉬기 좋은 바위턱을 알려 주었다.', '갱이가 처음 길을 잃었던 날 이야기를 내게 들려주었다.', '갱이가 내 옆에 램프를 걸었다. 오늘은 내가 앞장섰다.']
};

function ssAffinityDay(now = Date.now()) {
  return new Date(now + 4 * 3600000).toISOString().slice(0, 10);
}

function ssAffinityLevel(points) {
  return SS_AFFINITY_THRESHOLDS.filter(min => points >= min).length;
}

function ssAffinityCount(value, max) {
  return Number.isSafeInteger(value) ? Math.min(max, Math.max(0, value)) : 0;
}

function ssAffinityNormalize(raw) {
  if (raw && raw.v != null && raw.v !== 1) return raw;
  const npc = { ...raw?.npc };
  for (const id of Object.keys(SS_AFFINITY_NOTES)) {
    const old = npc[id];
    const points = ssAffinityCount(old?.points, 180);
    npc[id] = { ...old, points, level: ssAffinityLevel(points) };
  }
  return { ...raw, v: 1, npc, tickets: ssAffinityCount(raw?.tickets, 30),
    dayKey: typeof raw?.dayKey === 'string' ? raw.dayKey : '',
    deliveryPoints: ssAffinityCount(raw?.deliveryPoints, 10) };
}

// Returns a new state only when points actually change. The caller owns the save.
function ssAffinityGain(state, id, source, day) {
  if (state.v !== 1 || !Object.hasOwn(SS_AFFINITY_NOTES, id) || day < state.dayKey) return null;
  const resident = state.npc[id];
  const deliveries = day === state.dayKey ? state.deliveryPoints : 0;
  let gain;
  if (source === 'talk') {
    if (resident.greetedDay >= day) return null;
    gain = 6;
  } else if (source === 'delivery') {
    gain = Math.min(2, 10 - deliveries);
  } else return null;
  const points = Math.min(180, resident.points + gain);
  if (points === resident.points) return null;
  const level = ssAffinityLevel(points);
  const next = { ...resident, points, level };
  if (source === 'talk') next.greetedDay = day;
  return { ...state, npc: { ...state.npc, [id]: next }, dayKey: day,
    deliveryPoints: deliveries + (source === 'delivery' ? points - resident.points : 0),
    tickets: Math.min(30, state.tickets + (level - resident.level) * 2) };
}

// A 2.5D villager fulfils the same order and uses the same cooldown as the 2D counter.
function ssAffinityAtResident(id) {
  if (!town25dActive || ssRegion !== TOWN_WORLD_ID) return false;
  const target = t25Closest();
  return target?.npc === id && t25Distance(target) <= 2.65;
}

function ssAffinityPanel(npc, greet = true, notice = '') {
  const old = game.affinity;
  if (old.v !== 1 || !Object.hasOwn(SS_AFFINITY_NOTES, npc.id)) return;
  const candidate = greet && ssAffinityGain(old, npc.id, 'talk', ssAffinityDay());
  let result = notice;
  if (candidate) {
    game.affinity = candidate;
    if (saveGame(true)) {
      const before = old.npc[npc.id], after = candidate.npc[npc.id];
      result = '오늘 첫 대화 +' + (after.points - before.points);
      if (after.level > before.level) result += ' · 새 수첩 기록';
    } else {
      game.affinity = old;
      result = '인사를 저장하지 못했어요. 다시 말을 걸어 주세요.';
    }
  }
  const state = game.affinity, resident = state.npc[npc.id];
  const next = SS_AFFINITY_THRESHOLDS[resident.level];
  const progress = next ? resident.points + '/' + next : '180/180';
  const notes = SS_AFFINITY_NOTES[npc.id].slice(0, resident.level - 1);
  const records = notes.map(note => '<li>' + note + '</li>').join('');
  const roster = SS_NPC_DATA.filter(n => state.npc[n.id]).map(n => {
    const r = state.npc[n.id];
    return '<li>' + n.name + ' · ' + SS_AFFINITY_LEVELS[r.level - 1] + ' (' + r.points + ')</li>';
  }).join('');
  const orders = {harin: ['npc:carpenter', '원목 6개'], sola: ['npc:farmer', '밀 3개'], yeoul: ['npc:fisher', '물고기 2마리']};
  const order = orders[npc.id];
  const canDeliverHere = order && ssAffinityAtResident(npc.id);
  let delivery = '';
  if (canDeliverHere) {
    const customer = order[0].slice(4);
    const remaining = Math.ceil(game.livingP0.npcs[customer].readyAt - game.livingP0.clock);
    delivery = '<button class="ghost" type="button" id="ssAffinityDeliver"' + (remaining > 0 ? ' disabled' : '') + '>'
      + (remaining > 0 ? '다음 납품까지 ' + remaining + '초' : order[1] + ' 납품 · ' + LIVING_NPCS[customer].payout + '코인') + '</button>';
  }
  const wasOpen = document.querySelector('.ss-affinity')?.open;
  document.querySelector('.ss-affinity')?.remove();
  document.querySelector('.ss-affinity-result')?.remove();
  $('ssNpcProg').insertAdjacentHTML('afterend',
    '<details class="ss-affinity"><summary>♥ ' + npc.name + ' · ' + SS_AFFINITY_LEVELS[resident.level - 1]
    + ' · ' + progress + '점 <small>주민 수첩</small></summary>'
    + (records ? '<ul>' + records + '</ul>' : '<p>30점이 되면 ' + npc.name + '와의 첫 기록이 열려요.</p>')
    + '<p>오늘 첫 대화 +6 · 목수·농부·어부 납품 +2 (세 주민 합계 하루 10점) · 매일 오전 5시 갱신</p>'
    + delivery + '<ul class="ss-affinity-roster">' + roster + '</ul><p>축제 티켓 ' + state.tickets + '장 · 관계 단계가 오르면 2장 (최대 30장)</p></details>'
    + '<p class="ss-affinity-result" role="status"></p>');
  document.querySelector('.ss-affinity-result').textContent = result;
  if (wasOpen) document.querySelector('.ss-affinity').open = true;
  if (canDeliverHere && $('ssAffinityDeliver')) {
    $('ssAffinityDeliver').onclick = () => {
      const response = livingAction('npc.deliver', order[0], undefined, npc.id);
      ssAffinityPanel(npc, false, response.ok ? response.message : response.reason);
      document.querySelector('.ss-affinity summary').focus();
    };
  }
}
