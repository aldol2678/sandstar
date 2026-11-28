"""Attach resident bonds to the existing NPC modal and world-save transactions."""
from pathlib import Path
import sys


def patch(html):
    def replace(old, new):
        nonlocal html
        if html.count(old) != 1:
            raise ValueError(f"Expected one NPC affinity anchor: {old[:80]}")
        html = html.replace(old, new)

    source = "\n".join(Path(__file__).with_name(name).read_text(encoding="utf-8")
                       for name in ("residents.js", "chapter-one.js", "affinity.js", "dialog.js"))
    replace("function newGame(seed=", source + "\nfunction newGame(seed=")
    replace("return {storyM1:ssM1Fresh(),livingP0:freshLivingP0()",
            "return {affinity:ssAffinityNormalize(),storyM1:ssM1Fresh(),livingP0:freshLivingP0()")
    replace("d.livingP0=normalizeLivingP0(d.livingP0);",
            "d.affinity=ssAffinityNormalize(d.affinity);d.livingP0=normalizeLivingP0(d.livingP0);")
    start = html.index(" const storyBtn=npc.story?")
    end = html.index(" $('ssNpcReplay').onclick=", start)
    replace(html[start:end], " showModal(npc.name,ssNpcDialogBody(npc));ssNpcFrame(npc);\n")
    replace("'다음 ▶' : '다른 이야기'", "'다음 대화' : '다른 이야기'")
    replace("function showModal(title,html){", "function showModal(title,html){\n $('overlay').removeAttribute('aria-labelledby');")
    replace(" $('ssNpcReplay').onclick=", " ssAffinityPanel(npc);ssChapterConversation(npc);\n $('ssNpcReplay').onclick=")

    # Show heard testimony at the physical spring, on either side of the one-time repair.
    replace("생활·채굴은 계속할 수 있습니다.</p>');return true;}",
            "생활·채굴은 계속할 수 있습니다.</p>'+ssChapterFieldNotes(game));return true;}")
    replace("지역을 오가도 소지품은 보존됩니다.</p>`);",
            "지역을 오가도 소지품은 보존됩니다.</p>`+ssChapterFieldNotes(game));")
    replace("미발견 · 마을 X55", "미발견 · 광산 X55")
    replace("저쪽 X55에서 묘한 빛이 보여.", "광산 X55에서 묘한 빛이 보여.")
    replace("${game.storyM1.crystalSeen?'별빛 결정이라…",
            "${game.storyM1.springRepaired?'수문턱에 금을 그었어. 다음 물높이도 같이 재자.':game.storyM1.crystalSeen?'별빛 결정이라…")
    replace("const choices = [3,4,5].filter(i => i !== previous);",
            "const idleLines = id==='sola' && game.storyM1?.springRepaired ? [3,4] : [3,4,5];\n"
            "  const choices = idleLines.filter(i => i !== previous);")
    # The forest researcher and Harin's chapter option use the original chapter modal.
    replace("자원과 장비는 공유합니다.</p>`);return true;",
            "자원과 장비는 공유합니다.</p>`);ssNpcFrame(ssNpcById('harin'),true);ssChapterConversation(ssNpcById('harin'));return true;")
    replace("판단하지 않았습니다.</p>`);return true;",
            "판단하지 않았습니다.</p>`);ssNpcFrame(ssNpcById('seoon'),true);ssChapterConversation(ssNpcById('seoon'));return true;")

    # Limit the hook to livingAction. Cooking has a separate transaction with a similar shape.
    replace("if(!anywhereFood&&Math.abs(context.y-context.groundY)>5)",
            "const townDelivery=cmd.type==='npc.deliver' && context.townRecipient && "
            "SS_AFFINITY_DELIVERIES[cmd.target]===context.townRecipient;\n "
            "if(!anywhereFood&&!townDelivery&&Math.abs(context.y-context.groundY)>5)")
    replace("if(tx===null||Math.abs(context.x-tx)>5.2)",
            "if(tx===null||(!townDelivery&&Math.abs(context.x-tx)>5.2))")
    start = html.index("function livingAction(")
    end = html.index("function livingMenu()", start)
    old_action = html[start:end]
    action = old_action.replace("function livingAction(type,target,item){", """function livingAction(type,target,item,townRecipient){
 if (townRecipient && (type !== 'npc.deliver' || SS_AFFINITY_DELIVERIES[target] !== townRecipient || !ssAffinityAtResident(townRecipient))) {
   return {ok:false,reason:'주민에게 가까이 다가가 주세요'};
 }""")
    action = action.replace("if(!townOnly&&target", "if(!townRecipient&&!townOnly&&target")
    action = action.replace("groundY:terrain(p.x)-1,inv:", "groundY:terrain(p.x)-1,townRecipient,inv:")
    action = action.replace("if(!saveGame(true)){", """const oldAffinity = game.affinity;
 const recipient = type === 'npc.deliver' ? SS_AFFINITY_DELIVERIES[target] : null;
 const bond = recipient && ssAffinityGain(oldAffinity, recipient, 'delivery', ssAffinityDay());
 if (bond) game.affinity = bond;
 if(!saveGame(true)){
   game.affinity = oldAffinity;""")
    action = action.replace("updHud();flash(r.message);", """if (bond) {
   const gain = bond.npc[recipient].points - oldAffinity.npc[recipient].points;
   r.message += ' · ' + ssNpcById(recipient).name + ' 호감도 +' + gain;
 }
 updHud();flash(r.message);""")
    if action.count("if (bond)") != 2 or "townRecipient,inv:" not in action or "if(!townRecipient&&!townOnly" not in action:
        raise ValueError("Incomplete living delivery transaction")
    replace(old_action, action)
    css = """
.ss-chapter-talk,.ss-chapter-field{margin:.45rem 0;text-align:left}
.ss-chapter-talk summary,.ss-chapter-field summary{cursor:pointer;min-height:44px;box-sizing:border-box;padding:.7rem .2rem;font-weight:bold;color:#d8e7cf}
.ss-chapter-options{display:flex;flex-wrap:wrap;gap:.4rem}
.ss-chapter-options button{min-height:44px;white-space:normal}
.ss-chapter-response p,.ss-chapter-field li,.ss-chapter-field p{line-height:1.45}
.ss-affinity{margin:.45rem 0;text-align:left}
.ss-affinity summary{cursor:pointer;min-height:44px;box-sizing:border-box;padding:.7rem .2rem;font-weight:bold;color:#ffe6ac}
.ss-affinity summary small{font-weight:normal;text-decoration:underline}
.ss-affinity ul{padding-inline-start:1.4rem}
.ss-affinity-roster{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:.25rem .6rem}
.ss-affinity-result:empty{display:none}
.ss-affinity-result:not(:empty){padding:.4rem .55rem;border-left:2px solid #b5a06d}
.ss-affinity section{margin:.65rem 0;padding:.65rem .75rem;border:1px solid #776849;border-radius:8px}
.ss-affinity h3{font:inherit;font-weight:700;margin:0 0 .35rem;color:#ffe6ac}
.ss-affinity blockquote{margin:.45rem 0;padding-left:.65rem;border-left:2px solid #b5a06d}
.ss-affinity .ss-affinity-choices{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0}
.ss-affinity .ss-affinity-choices button{flex:1 1 9rem;min-height:44px;white-space:normal}
.ss-affinity p,.ss-affinity li,.ss-affinity-result{font-size:.9rem;line-height:1.45}
"""
    css += Path(__file__).with_name("dialog.css").read_text(encoding="utf-8")
    replace("</head>", "<style>" + css + "</style>\n</head>")
    return html


if __name__ == "__main__":
    source, output = map(Path, sys.argv[1:])
    output.write_text(patch(source.read_text(encoding="utf-8")), encoding="utf-8")
