// The village and the forest share the same portraits and dialog controls.
function ssNpcDialogBody(npc) {
  const story = npc.story ? '<button class="ghost" id="ssNpcStoryBtn" type="button">제1장 이야기 보기</button>' : '';
  return '<section class="ss-npc-speech"><p id="ssNpcProg"></p><p id="ssNpcLine" aria-live="polite" aria-atomic="true"></p>'
    + '<div class="ss-npc-controls"><button class="cta" id="ssNpcNextBtn" type="button">다음 대화</button>'
    + '<button class="ghost" id="ssNpcReplay" type="button">다시 듣기</button>'
    + '<button class="ghost" id="ssNpcHintBtn" type="button">힌트 듣기</button></div></section>'
    + '<div id="ssNpcExtras">' + story + '<div class="stack ss-npc-extra"></div></div>';
}

function ssNpcFrame(npc, chapter = false) {
  const dialog = $('dialog'), title = dialog.querySelector('h2'), close = $('backBtn');
  const heading = document.createElement('header');
  heading.className = 'ss-npc-head';
  heading.innerHTML = '<span class="ss-npc-portrait" aria-hidden="true"></span><div class="ss-npc-id"><span></span></div>';
  const portrait = heading.querySelector('.ss-npc-portrait');
  portrait.style.setProperty('--coat',npc.coat);
  const source = T24_IMAGES['npc-' + npc.id];
  portrait.textContent = npc.emoji;
  function drawPortrait() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 144;
    const context = canvas.getContext('2d');
    if (!context) return;
    const w = source.naturalWidth, h = source.naturalHeight;
    context.drawImage(source,w * .315,h * .148,w / 2.7,h / 2.7,0,0,144,144);
    portrait.replaceChildren(canvas);
  }
  if (source?.complete && source.naturalWidth) drawPortrait();
  else source?.addEventListener('load',drawPortrait,{once:true});
  heading.querySelector('.ss-npc-id span').textContent = npc.role;
  title.textContent = npc.name;
  title.id = 'ssNpcSpeaker';
  heading.querySelector('.ss-npc-id').append(title);
  const oldStack = close.parentElement;
  close.className = 'ss-npc-close';
  close.setAttribute('aria-label','대화 끝내기');
  close.title = '대화 끝내기';
  close.textContent = '×';
  heading.append(close);
  oldStack.remove();
  if (chapter) {
    const story = document.createElement('section');
    story.className = 'ss-npc-speech ss-npc-quest';
    const caption = document.createElement('h3');
    caption.textContent = '제1장 · 꺼진 샘의 비밀';
    story.append(caption,...dialog.children);
    const extras = document.createElement('div');
    extras.id = 'ssNpcExtras';
    dialog.append(story, extras);
  }
  dialog.prepend(heading);
  dialog.scrollTop = 0;
  $('overlay').setAttribute('aria-labelledby',title.id);
  (chapter ? close : $('ssNpcNextBtn')).focus({preventScroll:true});
}
