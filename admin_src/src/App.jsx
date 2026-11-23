import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import DashboardLayout from './components/DashboardLayout';
const NewsList = lazy(() => import('./pages/NewsList'));
const NewsEditor = lazy(() => import('./pages/NewsEditor'));

const FaqList = lazy(() => import('./pages/FaqList'));
const FaqEditor = lazy(() => import('./pages/FaqEditor'));
const AuthorList = lazy(() => import('./pages/AuthorList'));
const AuthorEditor = lazy(() => import('./pages/AuthorEditor'));
const ComparisonList = lazy(() => import('./pages/ComparisonList'));
const ComparisonEditor = lazy(() => import('./pages/ComparisonEditor'));
const CaseStudyList = lazy(() => import('./pages/CaseStudyList'));
const CaseStudyEditor = lazy(() => import('./pages/CaseStudyEditor'));
const AiCrawlerActivity = lazy(() => import('./pages/AiCrawlerActivity'));

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
      <Suspense fallback={<div role="status" className="p-8">Loading...</div>}>
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
          <Route path="authors" element={<AuthorList />} />
          <Route path="authors/new" element={<AuthorEditor />} />
          <Route path="authors/edit/:id" element={<AuthorEditor />} />
          <Route path="comparisons" element={<ComparisonList />} />
          <Route path="comparisons/new" element={<ComparisonEditor />} />
          <Route path="comparisons/edit/:id" element={<ComparisonEditor />} />
          <Route path="case-studies" element={<CaseStudyList />} />
          <Route path="case-studies/new" element={<CaseStudyEditor />} />
          <Route path="case-studies/edit/:id" element={<CaseStudyEditor />} />
          <Route path="ai-crawlers" element={<AiCrawlerActivity />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
