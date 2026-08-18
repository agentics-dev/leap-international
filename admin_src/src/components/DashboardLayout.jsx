import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, FileText, HelpCircle, Users, Scale, Trophy, Bot } from 'lucide-react';

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Leap Admin</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link
            to="/news"
            className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium ${
              location.pathname.startsWith('/news')
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-5 h-5 mr-3" />
            News & Activities
          </Link>
          <Link
            to="/faqs"
            className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium ${
              location.pathname.startsWith('/faqs')
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <HelpCircle className="w-5 h-5 mr-3" />
            FAQ Management
          </Link>
          <Link
            to="/authors"
            className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium ${
              location.pathname.startsWith('/authors')
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="w-5 h-5 mr-3" />
            Authors
          </Link>
          <Link
            to="/comparisons"
            className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium ${
              location.pathname.startsWith('/comparisons')
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Scale className="w-5 h-5 mr-3" />
            Comparison Pages
          </Link>
          <Link
            to="/case-studies"
            className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium ${
              location.pathname.startsWith('/case-studies')
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Trophy className="w-5 h-5 mr-3" />
            Case Studies
          </Link>
          <Link
            to="/ai-crawlers"
            className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium ${
              location.pathname.startsWith('/ai-crawlers')
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Bot className="w-5 h-5 mr-3" />
            AI Crawlers
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
