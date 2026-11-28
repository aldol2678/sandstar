// Use the same player for old voice clips and new lines so switching topics always cancels the previous take.
function ssNpcPlayQueue(urls) {
  ssNpcStopVoice();
  if (!sfxState?.enabled || !urls.length) return;
  const player = new Audio();
  ssNpcAudio = player;
  let index = 0;
  function advance() {
    if (ssNpcAudio !== player) return;
    if (index >= urls.length || !sfxState.enabled) {
      ssNpcStopVoice();
      return;
    }
    const current = ++index;
    player.volume = sfxState.volume;
    player.src = urls[current - 1];
    player.play()?.catch(error => {
      if (ssNpcAudio !== player || index !== current) return;
      if (error.name === 'NotSupportedError') advance();
      else ssNpcStopVoice();
    });
  }
  player.onended = advance;
  player.onerror = advance;
  advance();
}

function ssNpcVoiceUrls(id, lines) {
  return lines.map(line => SS_NPC_EXTRA_VOICES[id]?.[line]).filter(Boolean);
}
function ssNpcSpeak(id, lines) {
  ssNpcPlayQueue(ssNpcVoiceUrls(id, lines));
}
function ssNpcListenButton(parent, id, lines, label = '다시 듣기') {
  if (!ssNpcVoiceUrls(id,lines).length) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost ss-npc-listen';
  button.textContent = label;
  button.onclick = () => ssNpcSpeak(id,lines);
  parent.append(button);
}
