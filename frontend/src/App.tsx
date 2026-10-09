import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Templates from './pages/Templates';
import { Editor } from './pages/Editor';

function App() {
  const token = useAuthStore((state) => state.token);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/templates" /> : <Login />} />
        <Route path="/templates" element={token ? <Templates /> : <Navigate to="/login" />} />
        <Route path="/editor" element={token ? <Editor /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/templates" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
