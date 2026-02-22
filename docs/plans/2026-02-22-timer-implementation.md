# Timer Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a countdown timer mode to the stopwatch app, switchable via double-tap.

**Architecture:** Single `main.ts` file. Add `RebuildPageContainer` import. Introduce an `appMode` variable (`'stopwatch' | 'timer'`) and expand the state type. Mode switches call `rebuildPageContainer`. Timer uses scroll events for duration setting.

**Tech Stack:** TypeScript, `@evenrealities/even_hub_sdk` v0.0.7, Vite

---

### Task 1: Add imports and new state variables

**Files:**
- Modify: `src/main.ts:1-14`

**Step 1: Add `RebuildPageContainer` to imports and new state variables**

Update the import to include `RebuildPageContainer`, then add the new state variables below the existing ones.

```typescript
import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

type AppMode = 'stopwatch' | 'timer'
type StopwatchState = 'idle' | 'running' | 'paused'
type TimerState = 'setting' | 'running' | 'paused' | 'done'

let appMode: AppMode = 'stopwatch'
let swState: StopwatchState = 'idle'
let tmState: TimerState = 'setting'
let startTime = 0
let accumulatedMs = 0
let timerDurationMin = 5
let timerRemainingMs = 0
let intervalId: ReturnType<typeof setInterval> | null = null
```

**Step 2: Verify the app still builds**

Run: `cd /Users/markshteyn/projects/even/stopwatch && npx vite build`
Expected: Build succeeds (there will be unused variable warnings, that's fine)

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: add timer state variables and RebuildPageContainer import"
```

---

### Task 2: Add format helpers and buildPageContent

**Files:**
- Modify: `src/main.ts`

**Step 1: Replace `formatTime` with two formatters and add `buildPageContent`**

Replace the existing `formatTime` function (lines 16-25) with:

```typescript
function formatStopwatch(ms: number): string {
  const totalTenths = Math.floor(ms / 100)
  const tenths = totalTenths % 10
  const totalSeconds = Math.floor(totalTenths / 10)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return `${mm}:${ss}.${tenths}`
}

function formatTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return `${mm}:${ss}`
}

function buildPageContent(): string {
  if (appMode === 'stopwatch') {
    const elapsed = swState === 'running'
      ? accumulatedMs + (Date.now() - startTime)
      : accumulatedMs
    return `SW\n\n    ${formatStopwatch(elapsed)}`
  } else {
    if (tmState === 'setting') {
      return `TIMER\n\n    ${formatTimer(timerDurationMin * 60000)}`
    }
    return `TIMER\n\n    ${formatTimer(timerRemainingMs)}`
  }
}
```

**Step 2: Verify build**

Run: `cd /Users/markshteyn/projects/even/stopwatch && npx vite build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: add stopwatch/timer formatters and buildPageContent"
```

---

### Task 3: Refactor main() — container creation and display update

**Files:**
- Modify: `src/main.ts` (the `main()` function)

**Step 1: Replace the container creation and updateDisplay inside main()**

Replace the text container creation (lines 37-46), `createStartUpPageContainer` call (lines 48-53), status log (line 54), and `updateDisplay` function (lines 56-70) with:

```typescript
  function makeTextContainer(content: string): TextContainerProperty {
    return new TextContainerProperty({
      containerID: 1,
      containerName: 'main',
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      isEventCapture: 1,
      content,
    })
  }

  const initialContent = buildPageContent()
  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [makeTextContainer(initialContent)],
    })
  )
  status.textContent += `\nContainer created: ${result === 0 ? 'OK' : 'ERROR ' + result}`

  async function updateDisplay() {
    const content = buildPageContent()
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'main',
        contentOffset: 0,
        contentLength: content.length,
        content,
      })
    )
  }

  async function switchMode(newMode: AppMode) {
    appMode = newMode
    const content = buildPageContent()
    await bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 1,
        textObject: [makeTextContainer(content)],
      })
    )
  }
```

**Step 2: Update startTimer/stopTimer to use the new `intervalId` variable name**

Replace the existing `startTimer`/`stopTimer` (lines 72-82) with:

```typescript
  function startInterval(ms: number) {
    if (intervalId) return
    intervalId = setInterval(updateDisplay, ms)
  }

  function stopInterval() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
```

**Step 3: Verify build**

Run: `cd /Users/markshteyn/projects/even/stopwatch && npx vite build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: refactor container creation and add switchMode helper"
```

---

### Task 4: Rewrite event handler with full stopwatch + timer logic

**Files:**
- Modify: `src/main.ts` (the `onEvenHubEvent` callback)

**Step 1: Replace the event handler (lines 84-109) with the full state machine**

```typescript
  bridge.onEvenHubEvent((event) => {
    const eventType =
      event.textEvent?.eventType ??
      event.listEvent?.eventType ??
      event.sysEvent?.eventType

    const isTap = eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined
    const isDoubleTap = eventType === OsEventTypeList.DOUBLE_CLICK_EVENT
    const isScrollUp = eventType === OsEventTypeList.SCROLL_TOP_EVENT
    const isScrollDown = eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT

    if (appMode === 'stopwatch') {
      if (isTap) {
        if (swState === 'idle' || swState === 'paused') {
          startTime = Date.now()
          swState = 'running'
          startInterval(100)
        } else {
          accumulatedMs += Date.now() - startTime
          swState = 'paused'
          stopInterval()
        }
      } else if (isDoubleTap) {
        if (swState === 'paused') {
          accumulatedMs = 0
          swState = 'idle'
          updateDisplay()
        } else if (swState === 'idle') {
          swState = 'idle'
          accumulatedMs = 0
          tmState = 'setting'
          switchMode('timer')
        }
      }
    } else {
      // Timer mode
      if (tmState === 'setting') {
        if (isTap) {
          timerRemainingMs = timerDurationMin * 60000
          startTime = Date.now()
          tmState = 'running'
          startInterval(1000)
        } else if (isDoubleTap) {
          tmState = 'setting'
          swState = 'idle'
          accumulatedMs = 0
          switchMode('stopwatch')
        } else if (isScrollUp) {
          timerDurationMin = Math.min(60, timerDurationMin + 1)
          updateDisplay()
        } else if (isScrollDown) {
          timerDurationMin = Math.max(1, timerDurationMin - 1)
          updateDisplay()
        }
      } else if (tmState === 'running') {
        if (isTap) {
          timerRemainingMs -= Date.now() - startTime
          tmState = 'paused'
          stopInterval()
          updateDisplay()
        }
        // Check if timer hit zero (handled in updateDisplay via Task 5)
      } else if (tmState === 'paused') {
        if (isTap) {
          startTime = Date.now()
          tmState = 'running'
          startInterval(1000)
        } else if (isDoubleTap) {
          tmState = 'setting'
          stopInterval()
          updateDisplay()
        }
      } else if (tmState === 'done') {
        if (isTap || isDoubleTap) {
          stopInterval()
          tmState = 'setting'
          updateDisplay()
        }
      }
    }
  })
```

**Step 2: Verify build**

Run: `cd /Users/markshteyn/projects/even/stopwatch && npx vite build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: add full stopwatch/timer event handler with mode switching"
```

---

### Task 5: Add timer countdown logic and flash effect

**Files:**
- Modify: `src/main.ts`

**Step 1: Update `updateDisplay` to handle timer countdown completion and flash**

Replace the `updateDisplay` function with:

```typescript
  let flashOn = true
  let flashCount = 0

  async function updateDisplay() {
    if (appMode === 'timer' && tmState === 'running') {
      const elapsed = Date.now() - startTime
      timerRemainingMs = Math.max(0, timerRemainingMs - elapsed)
      startTime = Date.now()
      if (timerRemainingMs <= 0) {
        timerRemainingMs = 0
        tmState = 'done'
        stopInterval()
        flashOn = true
        flashCount = 0
        intervalId = setInterval(flashDisplay, 500)
        return
      }
    }
    const content = buildPageContent()
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'main',
        contentOffset: 0,
        contentLength: content.length,
        content,
      })
    )
  }

  async function flashDisplay() {
    flashCount++
    if (flashCount > 20) {
      stopInterval()
      tmState = 'setting'
      updateDisplay()
      return
    }
    flashOn = !flashOn
    const content = flashOn ? 'TIMER\n\n    00:00' : ' '
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'main',
        contentOffset: 0,
        contentLength: content.length,
        content,
      })
    )
  }
```

**Step 2: Verify build**

Run: `cd /Users/markshteyn/projects/even/stopwatch && npx vite build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: add timer countdown completion and flash effect"
```

---

### Task 6: Build and package

**Files:**
- Modify: `stopwatch.ehpk` (rebuilt)

**Step 1: Build and package**

Run: `cd /Users/markshteyn/projects/even/stopwatch && npx vite build && evenhub-package .`
Expected: Build succeeds, `stopwatch.ehpk` is regenerated

**Step 2: Commit**

```bash
git add src/main.ts stopwatch.ehpk
git commit -m "build: rebuild package with timer feature"
```

---

### Task 7: Manual testing checklist

Test in the simulator (`evenhub-simulator http://localhost:5173`):

1. App starts in stopwatch mode showing `SW\n\n    00:00.0`
2. Tap starts stopwatch, tap pauses, tap resumes
3. Double-tap when paused resets to idle
4. Double-tap when idle switches to timer mode (`TIMER\n\n    05:00`)
5. Scroll up increments duration, scroll down decrements (1-60 range)
6. Tap starts countdown (updates every second)
7. Tap during countdown pauses it
8. Tap when paused resumes
9. Double-tap when paused resets to setting
10. When countdown reaches 0, display flashes for ~10s then returns to setting
11. Tap during flash dismisses immediately
12. Double-tap in timer setting returns to stopwatch mode
