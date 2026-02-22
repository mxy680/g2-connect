# Timer Feature Design

## Summary

Add a countdown timer mode to the existing stopwatch app. Users switch between stopwatch and timer via double-tap when idle. The timer duration is set with scroll gestures (+/- 1 min) and started with a tap. When the timer reaches zero, the display flashes for 10 seconds.

## Approach

Single text container per mode, switching via `rebuildPageContainer`. Each mode gets a clean container setup. Brief flicker on mode switch is acceptable since it's an intentional user action.

## State Machine

```
App Mode: 'stopwatch' | 'timer'

Stopwatch states: idle -> running -> paused -> (idle on reset)
Timer states:     setting -> running -> paused -> done -> (setting on dismiss)
```

Mode switching: double-tap when in `stopwatch:idle` or `timer:setting` switches to the other mode.

## Interaction Map

| Mode | State | Tap | Double-tap | Scroll |
|------|-------|-----|------------|--------|
| Stopwatch | idle | Start | Switch to timer | -- |
| Stopwatch | running | Pause | -- | -- |
| Stopwatch | paused | Resume | Reset -> idle | -- |
| Timer | setting | Start countdown | Switch to stopwatch | +/- 1 min (1-60) |
| Timer | running | Pause | -- | -- |
| Timer | paused | Resume | Reset -> setting | -- |
| Timer | done | Dismiss -> setting | Dismiss -> setting | -- |

## Display

Both modes use a full-screen text container (576x288, isEventCapture: 1).

- Stopwatch: `"SW\n\n    MM:SS.T"`
- Timer setting: `"TIMER\n\n    MM:SS"`
- Timer running/paused: `"TIMER\n\n    MM:SS"`
- Timer done: flashes `"TIMER\n\n    00:00"` on/off (~500ms) for 10s, then auto-dismisses to setting

## Scroll Events

In `timer:setting` only:
- SCROLL_TOP_EVENT -> +1 minute (max 60)
- SCROLL_BOTTOM_EVENT -> -1 minute (min 1)

Default duration: 5 minutes. Duration persists across mode switches (not reset until timer completes).

## Implementation Notes

- `createStartUpPageContainer` is called once at startup (stopwatch mode)
- Mode switches use `rebuildPageContainer` with a new TextContainerProperty
- Timer countdown uses `setInterval(updateDisplay, 1000)` (no tenths needed)
- Stopwatch keeps its existing 100ms interval for tenths display
- Flash effect: toggle content between time string and spaces via `textContainerUpgrade`
- After 10s flash (20 toggles), auto-return to `timer:setting`
