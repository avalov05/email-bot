import { useInput } from 'ink'

type Handler = () => void

export interface Keymap {
  up?:     Handler
  down?:   Handler
  left?:   Handler
  right?:  Handler
  enter?:  Handler
  escape?: Handler
  tab?:    Handler
  q?:      Handler
  h?:      Handler
  [key: string]: Handler | undefined
}

export function useKeymap(map: Keymap) {
  useInput((input, key) => {
    if (key.upArrow)    map.up?.()
    if (key.downArrow)  map.down?.()
    if (key.leftArrow)  map.left?.()
    if (key.rightArrow) map.right?.()
    if (key.return)     map.enter?.()
    if (key.escape)     map.escape?.()
    if (key.tab)        map.tab?.()
    if (input === '?') map.h?.()          // ? aliases to h
    if (input)         map[input]?.()     // handles q, h, n, d, D, a, r, 1-9, etc.
  })
}
