import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Save, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

const LANGS = [
  { id: 'en', label: 'English' },
  { id: 'zh', label: '繁體中文' }
];

export default function FaqEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [activeLang, setActiveLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [faq, setFaq] = useState({
    question_en: '', answer_en: '',
    question_zh: '', answer_zh: ''
  });

  useEffect(() => {
    if (id) fetchFaq();
  }, [id]);

  const fetchFaq = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('id', id)
      .single();
      
    if (data) setFaq(data);
    setLoading(false);
  };

  const stripHtml = (html) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const handleSave = async () => {
    setSaving(true);
    
    // Validate plain text (strip any accidental HTML tags)
    const payload = {
      question_en: stripHtml(faq.question_en),
      answer_en: stripHtml(faq.answer_en),
      question_zh: stripHtml(faq.question_zh),
      answer_zh: stripHtml(faq.answer_zh)
    };

    if (!payload.question_en || !payload.answer_en || !payload.question_zh || !payload.answer_zh) {
      alert("All fields are required and must not be empty.");
      setSaving(false);
      return;
    }

    if (id) {
      await supabase.from('faqs').update(payload).eq('id', id);
    } else {
      const { data, error } = await supabase.from('faqs').insert([payload]).select().single();
      if (data) {
        navigate(`/faqs/edit/${data.id}`, { replace: true });
      }
      if (error) {
        alert("Failed to save: " + error.message);
      }
    }
    
    setSaving(false);
    alert('FAQ Saved successfully');
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/faqs')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{id ? 'Edit FAQ' : 'New FAQ'}</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save FAQ'}
        </button>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-sm">
            <strong>Note:</strong> FAQ contents are strictly limited to plain text. Any images, videos, or rich HTML formatting will be automatically stripped out upon saving.
          </div>

          {/* Content Card with Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-200 bg-gray-50">
              {LANGS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setActiveLang(l.id)}
                  className={clsx(
                    "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeLang === l.id 
                      ? "border-blue-600 text-blue-600 bg-white" 
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question ({activeLang.toUpperCase()}) <span className="text-red-500">*</span></label>
                <textarea
                  value={faq[`question_${activeLang}`]}
                  onChange={e => setFaq({...faq, [`question_${activeLang}`]: e.target.value})}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-medium"
                  placeholder="Enter the question here..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Answer ({activeLang.toUpperCase()}) <span className="text-red-500">*</span></label>
                <textarea
                  value={faq[`answer_${activeLang}`]}
                  onChange={e => setFaq({...faq, [`answer_${activeLang}`]: e.target.value})}
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter the plain text answer here..."
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
