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

function formatTime(ms: number): string {
  const totalTenths = Math.floor(ms / 100)
  const tenths = totalTenths % 10
  const totalSeconds = Math.floor(totalTenths / 10)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return `${mm}:${ss}.${tenths}`
}

// Phone-side status for debugging
const status = document.createElement('pre')
status.style.cssText = 'font:16px monospace;padding:20px'
status.textContent = 'Waiting for bridge...'
document.body.appendChild(status)

async function main() {
  const bridge = await waitForEvenAppBridge()
  status.textContent += '\nBridge ready!'

  const text = new TextContainerProperty({
    containerID: 1,
    containerName: 'main',
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    isEventCapture: 1,
    content: '00:00.0',
  })

  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [text],
    })
  )
  status.textContent += `\nContainer created: ${result === 0 ? 'OK' : 'ERROR ' + result}`

  async function updateDisplay() {
    const elapsed = swState === 'running'
      ? accumulatedMs + (Date.now() - startTime)
      : accumulatedMs
    const display = formatTime(elapsed)
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'main',
        contentOffset: 0,
        contentLength: 7,
        content: display,
      })
    )
  }

  function startTimer() {
    if (intervalId) return
    intervalId = setInterval(updateDisplay, 100)
  }

  function stopTimer() {
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

    // Tap: start / pause / resume
    if (eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined) {
      if (swState === 'idle' || swState === 'paused') {
        startTime = Date.now()
        swState = 'running'
        startTimer()
      } else {
        accumulatedMs += Date.now() - startTime
        swState = 'paused'
        stopTimer()
      }
    }

    // Double-tap: reset (only when paused)
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT && swState === 'paused') {
      accumulatedMs = 0
      swState = 'idle'
      updateDisplay()
    }
  })
}

main()
