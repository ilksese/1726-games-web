export interface SkillCard {
  /** 牌的稳定编号，发牌和出牌都用它。 */
  id: string
  /** 完整牌名，选中后和牌河里展示。 */
  name: string
  /** 牌面中间的主字，要短，能一眼认出。 */
  displayName: string
  /** 口头规则。页面只展示，不执行。 */
  effect: string
  /** buff 增益，debuff 减益，skill 特殊技能。 */
  kind: 'buff' | 'debuff' | 'skill'
  /** 牌山里这种牌最多放几张。 */
  maxCount: number
}
export const HAND_SIZE = 3
export const ROUNDS_PER_MATCH = 5
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4
export const VOTE_MS = 5000
export const REMATCH_MS = 30000

const SCOPES = [
  { id: 'this', name: '本次' },
  { id: 'next-draw', name: '直到下一次摸牌' },
] as const

const ACTIONS = [
  { id: 'pung', name: '碰' },
  { id: 'kong', name: '杠' },
  { id: 'discard', name: '切' },
] as const

const SUITS = [
  { id: 'chars', name: '万子' },
  { id: 'bams', name: '条子' },
  { id: 'dots', name: '筒子' },
  { id: 'honors', name: '字牌' },
] as const

export const WARD: SkillCard = {
  id: 'ward',
  name: '休想',
  displayName: '休',
  kind: 'buff',
  maxCount: 5,
  effect: '无效一次受到的减益。',
}

export const ROB: SkillCard = {
  id: 'rob',
  name: '截胡',
  displayName: '截',
  kind: 'skill',
  maxCount: 5,
  effect: '自己已听牌，且对方所胡的牌在自己所听之中，才能打出。对方胡牌无效，我方胜利。',
}

export const SWAP: SkillCard = {
  id: 'swap',
  name: '换牌',
  displayName: '换',
  kind: 'skill',
  maxCount: 5,
  effect: '指定一名玩家，随机用我方手牌交换对方最多三张麻将牌。换完后每人都至少留一张麻将牌。',
}

function debuff(scope: (typeof SCOPES)[number], action: (typeof ACTIONS)[number], suit: (typeof SUITS)[number]): SkillCard {
  const name = `${scope.name}禁止${action.name}${suit.name}`
  return {
    id: `${scope.id}:${action.id}:${suit.id}`,
    name,
    displayName: `${action.name}${suit.name.slice(0, 1)}`,
    kind: 'debuff',
    maxCount: 5,
    effect: `指定一名玩家，${name}。`,
  }
}

export const SKILLS: SkillCard[] = [
  WARD,
  ROB,
  SWAP,
  ...SCOPES.flatMap((scope) => ACTIONS.flatMap((action) => SUITS.map((suit) => debuff(scope, action, suit)))),
]

const byId = new Map(SKILLS.map((skill) => [skill.id, skill]))

export function buildPool(): string[] {
  return SKILLS.flatMap((skill) => Array.from({ length: skill.maxCount }, () => skill.id))
}

export function skillById(id: string): SkillCard {
  return byId.get(id) || { id, name: id || '技能', displayName: '技', kind: 'debuff', maxCount: 0, effect: '指定一名玩家。' }
}
