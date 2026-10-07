# Recording KAYA's voice with ElevenLabs

The coach speaks 109 short lines: rep counts, form corrections, praise,
breathwork guidance and the deep-rest (NSDR) script. The full list is in
[`KAYA-voice-script.md`](KAYA-voice-script.md) (easy to read) and
[`KAYA-voice-script.csv`](KAYA-voice-script.csv) (one row per clip).

## Option A — one by one in the ElevenLabs website

1. Pick or design your voice in ElevenLabs. Use the same voice for every line.
2. Model: **Eleven Multilingual v2**. Output: **MP3, 44.1 kHz, 128 kbps**.
3. For each row, paste the text, generate, and download.
4. Rename the download to the exact file name in the script, e.g. `fix-squat-partial.mp3`.
5. Send all the files back (a zip is easiest). They go in `assets/voice/`.

Delivery tips: counts and praise short and energetic; form corrections firm
but friendly; breathwork slow and calm with a little silence at the end;
NSDR almost a whisper. Trim long silence at the start of each file so the
coach reacts instantly.

## Option B — all 109 clips with one command

If you have Node.js 18+ on a computer:

```bash
ELEVENLABS_API_KEY=your_key ELEVENLABS_VOICE_ID=your_voice_id node tools/elevenlabs-generate.mjs
node tools/voice-manifest.mjs
```

The script uses calmer settings for breathwork automatically and skips files
that already exist. Keep your API key private.

## Adding the clips to the app

1. Put the `.mp3` files in `assets/voice/`.
2. Run `node tools/voice-manifest.mjs` — it lists anything missing or misnamed.
3. Rebuild the APK (`npm run build:apk`).

Any line without a recording falls back to the phone's own voice, so a partial
set still works.
