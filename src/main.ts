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

// Phone-side status for debugging
const status = document.createElement('pre')
status.style.cssText = 'font:16px monospace;padding:20px'
status.textContent = 'Waiting for bridge...'
document.body.appendChild(status)

async function main() {
  const bridge = await waitForEvenAppBridge()
  status.textContent += '\nBridge ready!'

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

  let flashOn = true
  let flashCount = 0

  const initialContent = buildPageContent()
  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [makeTextContainer(initialContent)],
    })
  )
  status.textContent += `\nContainer created: ${result === 0 ? 'OK' : 'ERROR ' + result}`

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
}

main()
