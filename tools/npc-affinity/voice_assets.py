"""Validate the recorded dialogue and emit the lookup for static or self-contained builds."""
import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "assets" / "npc-voices-v4"


def voice_map(inline=False, stage=None):
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    voices = {}
    for row in manifest["clips"]:
        npc, key, line, sha = (row[item] for item in ("npc", "key", "line", "sha256"))
        data = (ROOT / npc / (key + ".mp3")).read_bytes()
        if hashlib.sha256(data).hexdigest() != sha:
            raise ValueError(f"NPC recording mismatch: {npc}/{key}")
        rel = f"npc-voices/v4/{npc}/{key}-{sha[:12]}.mp3"
        if stage:
            target = stage / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        url = "data:audio/mpeg;base64," + base64.b64encode(data).decode() if inline else "/" + rel
        speaker = voices.setdefault(npc, {})
        if line in speaker:
            raise ValueError(f"Duplicate NPC recording: {npc}/{key}")
        speaker[line] = url
    return voices


if __name__ == "__main__":
    import sys
    out = Path(sys.argv[1])
    voice_map(stage=out)
    with (out / "_headers").open("a", encoding="utf-8") as headers:
        headers.write("\n/npc-voices/v4/*\n  Content-Type: audio/mpeg\n  Cache-Control: public, max-age=31536000, immutable\n")
