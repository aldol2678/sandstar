// Use the chapter's world-save flags. Visiting the forest and inspecting the crystal can happen in either order.
const SS_CHAPTER_ONE_TOPICS = [
  { key: 'crystalSeen', label: '광산의 별광' },
  { key: 'forestVisited', label: '잔빛숲 가는 길' },
  { key: 'springRepaired', label: '돌아온 별샘 물길' }
];

const SS_CHAPTER_ONE_VOICES = {
  harin: {
    arrival: '저 빈집 문은 아직 열려. 경첩은 내가 봐 두거든.',
    crystalSeen: '그 빛, 수로 이음매에서도 본 적 있어.',
    forestVisited: '숲 난간 봤어? 여울이 짚는 쪽만 유난히 닳았어.',
    springRepaired: '수문턱에 물금이 생겼어. 오늘 높이를 새겨 둘게.',
    personal: {trace:'네가 문틀의 금을 본떴지. 이 물금도 남기고 싶어.',new:'문틀에 네 키를 쟀듯이, 오늘 물높이도 쟀어.'}
  },
  sola: {
    arrival: '마른 밭에서도 싹튼 씨앗은 따로 모아 뒀어.',
    crystalSeen: '광산이 빛난 날엔 밭흙도 달라졌을까? 적어 두자.',
    forestVisited: '숲길 풀은 강 쪽 잎부터 말렸어. 내 수첩에 그렸어.',
    springRepaired: '샘 가까운 흙부터 젖었어. 먼 밭은 내일 또 볼래.',
    personal: {date:'싹튼 날 옆에 흙이 젖은 날도 네 글씨로 써 줘.',nickname:'낮잠밭 흙은 아직 말랐어. 우리 같이 기다려 보자.'}
  },
  yeoul: {
    arrival: '옛날엔 눈을 감고도 마을에서 강 굽이를 셌어.',
    crystalSeen: '네가 본 빛 얘기, 나도 별샘에서 본 게 있어.',
    forestVisited: '마른 돌에도 물금은 남아. 옛 강은 저리 굽었지.',
    springRepaired: '샘 아래 첫 굽이에서 물소리가 나. 거기까진 들었어.',
    personal: {ripple:'그날 같이 듣던 자갈, 샘 아래서도 구르더라.',pool:'깊은 소는 아직 조용해. 네가 골랐던 자리 말이야.'}
  },
  seoon: {
    arrival: '수로 도면 한쪽이 비었어. 빈칸은 빈칸으로 둘게.',
    crystalSeen: '별광이 되풀이된 간격부터 적자. 밝기는 그다음이야.',
    forestVisited: '여울이 짚은 굽이가 내 도면엔 없어. 다시 재 볼게.',
    springRepaired: '장치에 남은 경고를 옮겨 적었어. 쓴 이는 몰라.',
    personal: {light:'꼬리표에 적은 그 빛깔로는 경고의 뜻을 못 읽어.',place:'그때처럼 위치부터 쓰자. 경고는 장치에 새겨졌어.'}
  },
  maru: {
    arrival: '빈 좌판도 아침마다 닦지. 누가 돌아올지 모르잖아!',
    crystalSeen: '값은 나중에 매기자고. 어디서 빛났는지부터 듣자!',
    forestVisited: '숲길 걸어 봤지? 물 한 통 이고 오면 꽤 멀어!',
    springRepaired: '첫 굽이에 물이 찼대. 물지게는 아직 팔 때가 아냐.',
    personal: {trade:'그 첫 손님도 물값보다 수문 안부부터 묻더라니까.',share:'감자 나눠 먹던 이들 몫으로 물 한 통 남겨 두자.'}
  },
  tobak: {
    arrival: '수문 고칠 쇠못은 모루 밑에 챙겨 뒀다.',
    crystalSeen: '광맥에서 낸 빛이군. 화덕에 넣기 전부터였나?',
    forestVisited: '숲길 이음쇠를 보면 녹이 어디까지 슬었나 봐 둬.',
    springRepaired: '물 닿은 쇠부터 살핀다. 수문은 고친 뒤가 더 길어.',
    personal: {steady:'가운데 두드리던 그 손으로 수문 떨림을 짚어 봐.',edge:'네가 만져 본 쇠끝처럼, 수문 모서리도 살펴야지.'}
  },
  gaengi: {
    arrival: '꺼진 갱도에서도 돌아오는 쪽은 표시해 둔다고!',
    crystalSeen: '등불은 가려 봤냐? 돌이 스스로 빛나는지 보자고!',
    forestVisited: '숲에선 물금, 갱도에선 젖은 벽이지. 모양을 봐!',
    springRepaired: '샘 하나가 깼다고 깊은 갱도까지 안심하진 마라!',
    personal: {dent:'헬멧 찧던 얘기 기억하지? 물 구경할 때도 위를 봐!',scratch:'그 헬멧 빌려 준 후배랑도 물소릴 꼭 같이 듣지.'}
  }
};

const SS_CHAPTER_ONE_CONNECTIONS = [
  {key:'crystalSeen', people:['maru','tobak','gaengi'], title:'등불과 화덕 밖에서',
    note:'갱이는 등불을, 토박은 화덕을 물었다. 마루의 장부에 먼저 적을 것은 값보다 광맥의 위치다.'},
  {key:'forestVisited', people:['yeoul','sola'], title:'물이 지나간 자리',
    note:'여울은 돌에 남은 물금을, 솔아는 강 쪽으로 말린 잎을 짚었다. 옛 강의 굽이를 다시 살펴볼 만하다.'},
  {key:'springRepaired', people:['harin','seoon'], title:'수문턱의 금과 장치의 글',
    note:'하린은 돌아온 물의 높이를 새겼고 서온은 경고를 베꼈다. 물이 돌아온 구간은 알지만 누가 왜 장치를 봉했는지는 아직 모른다.'}
];

function ssChapterTopics(story) {
  return SS_CHAPTER_ONE_TOPICS.filter(topic => story?.[topic.key] === true);
}

function ssChapterConnections(world) {
  if (world.affinity?.v !== 1) return [];
  return SS_CHAPTER_ONE_CONNECTIONS.filter(entry => world.storyM1?.[entry.key] === true
    && entry.people.every(id => world.affinity.npc[id]?.chapterHeard?.includes(entry.key)));
}

function ssChapterListen(npc, key) {
  const old = game.affinity, topic = ssChapterTopics(game.storyM1).find(t => t.key === key);
  if (old?.v !== 1 || !topic || !Object.hasOwn(SS_CHAPTER_ONE_VOICES,npc.id)) return false;
  const resident = old.npc[npc.id];
  if (resident.chapterHeard.includes(key)) return true;
  game.affinity = { ...old, npc: { ...old.npc, [npc.id]: { ...resident, chapterHeard: [...resident.chapterHeard,key] } } };
  if (saveGame(true)) return true;
  game.affinity = old;
  return false;
}

function ssChapterConversation(npc, anchor = $('ssNpcExtras')) {
  const topics = ssChapterTopics(game.storyM1), voice = SS_CHAPTER_ONE_VOICES[npc.id];
  if (!voice || !anchor || game.affinity?.v !== 1) return;
  const resident = game.affinity.npc[npc.id];
  const options = topics.map(t => '<button type="button" class="ghost" data-chapter-topic="' + t.key + '">'
    + t.label + (resident.chapterHeard.includes(t.key) ? ' · 다시 보기' : ' 묻기') + '</button>').join('');
  const element = document.createElement('details');
  element.className = 'ss-chapter-talk';
  element.innerHTML = '<summary>제1장 · 마을 소식</summary><div class="ss-chapter-options">' + options
    + '</div><div class="ss-chapter-response" role="status"><p></p></div>';
  const response = element.querySelector('.ss-chapter-response');
  response.firstChild.textContent = voice.arrival;
  let currentLines = [voice.arrival];
  ssNpcListenButton(response,npc.id,currentLines);
  element.ontoggle = () => {
    if (element.open && element.isConnected) ssNpcSpeak(npc.id,currentLines);
  };
  anchor.insertBefore(element,anchor.querySelector('.ss-npc-extra'));
  const storyButton = $('ssNpcStoryBtn');
  if (storyButton) element.querySelector('.ss-chapter-options').append(storyButton);
  element.querySelectorAll('[data-chapter-topic]').forEach(button => {
    button.onclick = () => {
      const key = button.dataset.chapterTopic;
      if (!ssChapterListen(npc,key)) {
        ssNpcStopVoice();
        currentLines = [];
        response.textContent = '이야기를 기록하지 못했어요. 다시 물어 주세요.';
        return;
      }
      const bond = game.affinity.npc[npc.id];
      const topic = topics.find(t => t.key === key);
      button.textContent = topic.label + ' · 다시 보기';
      const spoken = [voice[key]];
      if (key === 'springRepaired' && bond.level >= 3 && Object.hasOwn(voice.personal,bond.memory)) {
        spoken.push(voice.personal[bond.memory]);
      }
      const riverRewards = game.livingP0?.river?.rewards;
      if (npc.id === 'yeoul' && key === 'springRepaired' && Array.isArray(riverRewards)
          && riverRewards.includes('river-record-marks-1')) {
        spoken.push('전에 네 도감으로 짚은 물길, 그 표식부터 다시 보자.');
      }
      const match = ssChapterConnections(game).find(entry => entry.key === key && entry.people.includes(npc.id));
      currentLines = spoken;
      ssNpcSpeak(npc.id,spoken);
      response.replaceChildren();
      for (const line of spoken) {
        const p = document.createElement('p');
        p.textContent = '“' + line + '”';
        response.append(p);
      }
      ssNpcListenButton(response,npc.id,spoken);
      if (match) {
        const p = document.createElement('p');
        p.textContent = '함께 읽은 단서 · ' + match.title + ' — ' + match.note;
        response.append(p);
      }
    };
  });
}

function ssChapterFieldNotes(world) {
  if (world.affinity?.v !== 1) return '';
  const groups = ssChapterTopics(world.storyM1).map(topic => {
    const heard = SS_NPC_DATA.filter(n => world.affinity.npc[n.id]?.chapterHeard?.includes(topic.key)
      && Object.hasOwn(SS_CHAPTER_ONE_VOICES,n.id));
    if (!heard.length) return '';
    return '<h3>' + topic.label + '</h3><ul>' + heard.map(n => '<li><strong>' + n.name
      + '</strong> · ' + SS_CHAPTER_ONE_VOICES[n.id][topic.key] + '</li>').join('') + '</ul>';
  }).join('');
  if (!groups) return '';
  const links = ssChapterConnections(world).map(entry => '<p><strong>' + entry.title + '</strong> · ' + entry.note + '</p>').join('');
  return '<details class="ss-chapter-field"><summary>별샘 조사 수첩 · 주민에게 들은 말</summary>'
    + groups + links + '</details>';
}
