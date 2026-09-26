import { Routes, Route } from 'react-router-dom'
import Lobby from '@games/lobby'
import NumberDetective from '@games/number-detective'
import WhoDrinks from '@games/who-drinks'
import WanxiangMahjong from '@games/wanxiang-mahjong'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/number-detective" element={<NumberDetective />} />
      <Route path="/who-drinks" element={<WhoDrinks />} />
      <Route path="/wanxiang-mahjong" element={<WanxiangMahjong />} />
    </Routes>
  )
}
