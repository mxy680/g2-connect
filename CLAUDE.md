# Even Stopwatch + Timer

Stopwatch and countdown timer app for Even G2 smart glasses.

## Architecture

Single `src/main.ts` file with two modes:
- **Stopwatch:** idle → running → paused. Tap to start/pause, double-tap to reset.
- **Timer:** setting → running → paused → done. Scroll to set duration (1-60 min), tap to start, double-tap when idle to switch modes.

Mode switching uses `rebuildPageContainer`. Display updates use `textContainerUpgrade`.

## SDK Gotchas

- **Container position fields:** Use `xPosition`, `yPosition`, `width`, `height` — NOT `containerX/Y/W/H`. The SDK README and `.d.ts` types use the former; older docs/skills may reference the latter.
- **`createStartUpPageContainer` can only be called once.** Subsequent calls return error. Use `rebuildPageContainer` for page updates. This means HMR during development can break the app — restart the simulator after code changes.
- **CLICK_EVENT = 0** which JSON parsing can normalize to `undefined`. Always check both `=== OsEventTypeList.CLICK_EVENT` and `=== undefined`.
- **SDK version:** Latest is `0.0.7` (not `0.1.x`). Use `^0.0.7` in package.json.
- **`textContainerUpgrade` contentLength:** This is the replacement range in the *existing* content. Use `2000` (SDK max) to always replace the full container, avoiding stale characters when content length changes.
- **Packaging CLI:** `evenhub pack app.json dist -o stopwatch.ehpk` (not `evenhub-package`).

## Running

```bash
npm run dev                                    # Vite on :5173
evenhub-simulator http://localhost:5173        # Simulator
```
