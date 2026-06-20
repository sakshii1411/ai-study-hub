import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
      <div className="text-center">
        <div className="text-8xl font-black text-indigo-100 dark:text-indigo-900 select-none mb-2">404</div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Page not found</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">The page you're looking for doesn't exist.</p>
        <button onClick={() => navigate("/")}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default NotFound;
