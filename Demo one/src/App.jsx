import { Link, Route, Routes } from 'react-router-dom'
import Classroom from './pages/Classroom'
import Overview from './pages/Overview'
import Setup from './pages/Setup'

export default function App(){
  return (
    <div className="min-h-screen flex flex-col" style={{
      width: '100%',
      overflowX: 'hidden',
      background: '#0A0A0A'
    }}>
      <header className="sticky top-0 z-50" style={{background: '#0A0A0A', borderBottom: '1px solid #2D2D2D'}}>
        <div className="container mx-auto px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center text-white font-bold" style={{background: 'linear-gradient(135deg, #D4AF37, #FFD700)'}}>E</div>
            <span className="font-bold text-xl" style={{color: '#FFFFFF'}}>EduAgent Pro</span>
          </Link>
        </div>
      </header>
      <main className="flex-1" style={{width: '100%'}}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/setup/*" element={<Setup />} />
          <Route path="/classroom" element={<Classroom />} />
          <Route path="/demo" element={<Overview />} />
        </Routes>
      </main>
    </div>
  )
}
