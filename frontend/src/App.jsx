import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Poll from './pages/Poll.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/poll/:id" element={<Poll />} />
    </Routes>
  )
}

export default App
