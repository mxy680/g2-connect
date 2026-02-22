import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

type State = 'idle' | 'running' | 'paused'

let state: State = 'idle'
let startTime = 0
let accumulatedMs = 0
let timerInterval: ReturnType<typeof setInterval> | null = null

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

async function main() {
  const bridge = await waitForEvenAppBridge()

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

  await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [text],
    })
  )

  async function updateDisplay() {
    const elapsed = state === 'running'
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
    if (timerInterval) return
    timerInterval = setInterval(updateDisplay, 100)
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  bridge.onEvenHubEvent((event) => {
    const eventType =
      event.textEvent?.eventType ??
      event.listEvent?.eventType ??
      event.sysEvent?.eventType

    // Tap: start / pause / resume
    if (eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined) {
      if (state === 'idle' || state === 'paused') {
        startTime = Date.now()
        state = 'running'
        startTimer()
      } else {
        accumulatedMs += Date.now() - startTime
        state = 'paused'
        stopTimer()
      }
    }

    // Double-tap: reset (only when paused)
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT && state === 'paused') {
      accumulatedMs = 0
      state = 'idle'
      updateDisplay()
    }
  })
}

main()
