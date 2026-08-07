import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import DashboardLayout from './components/DashboardLayout';
import NewsList from './pages/NewsList';
import NewsEditor from './pages/NewsEditor';

import FaqList from './pages/FaqList';
import FaqEditor from './pages/FaqEditor';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route 
          path="/login" 
          element={!session ? <Login /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/" 
          element={session ? <DashboardLayout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Navigate to="/news" replace />} />
          <Route path="news" element={<NewsList />} />
          <Route path="news/new" element={<NewsEditor />} />
          <Route path="news/edit/:id" element={<NewsEditor />} />
          <Route path="faqs" element={<FaqList />} />
          <Route path="faqs/new" element={<FaqEditor />} />
          <Route path="faqs/edit/:id" element={<FaqEditor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
