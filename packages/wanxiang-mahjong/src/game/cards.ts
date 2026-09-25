export interface SkillCard {
  id: string
  name: string
  effect: string
}

export const COPIES = 5
export const HAND_SIZE = 3
export const ROUNDS_PER_MATCH = 5
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4
export const VOTE_MS = 5000
export const REMATCH_MS = 30000

export const SKILLS: SkillCard[] = [
  { id: 'no-pung', name: '禁止碰牌', effect: '指定一名玩家，直到这一轮结束，禁止碰牌。' },
  { id: 'no-kong', name: '禁止杠牌', effect: '指定一名玩家，直到这一轮结束，禁止杠牌。' },
  { id: 'no-chow', name: '禁止吃牌', effect: '指定一名玩家，直到这一轮结束，禁止吃牌。' },
  { id: 'no-win', name: '禁止胡牌', effect: '指定一名玩家，直到这一轮结束，禁止胡牌。' },
  { id: 'no-dots', name: '禁止筒子', effect: '指定一名玩家，直到这一轮结束，禁止打出筒子。' },
  { id: 'no-bams', name: '禁止条子', effect: '指定一名玩家，直到这一轮结束，禁止打出条子。' },
  { id: 'no-chars', name: '禁止万子', effect: '指定一名玩家，直到这一轮结束，禁止打出万子。' },
  { id: 'no-honors', name: '禁止字牌', effect: '指定一名玩家，直到这一轮结束，禁止打出字牌。' },
  { id: 'no-draw', name: '禁止摸牌', effect: '指定一名玩家，直到这一轮结束，禁止摸牌。' },
  { id: 'no-ready', name: '禁止听牌', effect: '指定一名玩家，直到这一轮结束，禁止宣告听牌。' },
  { id: 'no-meld-in', name: '禁止入鸣', effect: '指定一名玩家，直到这一轮结束，禁止把自己的牌放入别人的鸣牌。' },
  { id: 'no-remeld', name: '禁止换鸣', effect: '指定一名玩家，直到这一轮结束，禁止更换自己的鸣牌。' },
]

export function buildPool(): string[] {
  return SKILLS.flatMap((skill) => Array.from({ length: COPIES }, () => skill.id))
}

export function skillById(id: string): SkillCard {
  const skill = SKILLS.find((item) => item.id === id)
  if (!skill) throw new Error(`unknown skill: ${id}`)
  return skill
}
