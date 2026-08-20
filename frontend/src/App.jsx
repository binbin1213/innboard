import { Navigate, Route, Routes } from 'react-router-dom'
import Display from './pages/Display'
import AdminLayout from './pages/admin/AdminLayout'
import AnnouncementsPage from './pages/admin/AnnouncementsPage'
import ImagesPage from './pages/admin/ImagesPage'
import Login from './pages/admin/Login'
import RoomsPage from './pages/admin/RoomsPage'
import SettingsPage from './pages/admin/SettingsPage'
import WelcomePage from './pages/admin/WelcomePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/display" replace />} />
      <Route path="/display" element={<Display />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="rooms" replace />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="images" element={<ImagesPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="welcome" element={<WelcomePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/display" replace />} />
    </Routes>
  )
}
