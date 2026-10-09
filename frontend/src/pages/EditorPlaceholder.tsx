import { useNavigate } from 'react-router-dom';

export default function EditorPlaceholder() {
  const navigate = useNavigate();

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Editor Placeholder</h1>
      <p className="text-gray-600 mb-8">This will be implemented in Phase 2.</p>
      <button 
        onClick={() => navigate('/templates')}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Back to Templates
      </button>
    </div>
  );
}
