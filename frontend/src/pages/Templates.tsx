import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export default function Templates() {
  const setToken = useAuthStore((state) => state.setToken);
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Templates</h1>
        <button 
          onClick={() => setToken(null)}
          className="text-gray-500 hover:text-gray-800"
        >
          Logout
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => navigate('/editor')}
          className="border-2 border-dashed border-gray-300 rounded-lg h-64 flex items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          <span className="text-gray-500 font-medium">+ New blank receipt</span>
        </div>
      </div>
    </div>
  );
}
