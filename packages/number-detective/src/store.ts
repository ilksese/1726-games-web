import { atom } from 'jotai'

export type Screen = 'role-select' | 'exchange' | 'room-exchange' | 'setup' | 'play' | 'result'
export type Mode = 'host' | 'guest' | 'host-cloudflare' | 'guest-cloudflare'
export type ToastKind = 'win' | 'lose' | 'match' | 'info'

export interface Toast {
  text: string
  kind: ToastKind
  id: number
}

export const screenAtom = atom<Screen>('role-select')
export const modeAtom = atom<Mode>('host')
export const encodedOfferAtom = atom<string | null>(null)
export const errorAtom = atom('')
export const wonAtom = atom(false)
export const toastAtom = atom<Toast | null>(null)
export const versionAtom = atom(0)

export const secretAtom = atom('')
export const myReadyAtom = atom(false)
export const oppReadyAtom = atom(false)
export const guessAtom = atom('')
export const historyTabAtom = atom<'mine' | 'opp'>('mine')
