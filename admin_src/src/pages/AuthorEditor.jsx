import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Save, ArrowLeft } from 'lucide-react';

const EMPTY = {
  slug: '', name: '', name_zh: '',
  title: '', title_zh: '',
  credential: '', credential_zh: '',
  bio: '', bio_zh: '',
  photo_url: '', linkedin_url: '',
  is_active: true,
};

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function AuthorEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [author, setAuthor] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      setLoading(true);
      supabase.from('authors').select('*').eq('id', id).single().then(({ data }) => {
        if (data) setAuthor({ ...EMPTY, ...data });
        setLoading(false);
      });
    }
  }, [id]);

  const handleSave = async () => {
    if (!author.name.trim()) {
      alert('Name is required.');
      return;
    }
    setSaving(true);
    const payload = { ...author };
    if (!payload.slug && payload.name) {
      payload.slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    let error;
    if (id) {
      ({ error } = await supabase.from('authors').update(payload).eq('id', id));
    } else {
      ({ error } = await supabase.from('authors').insert([payload]));
    }
    setSaving(false);
    if (error) {
      alert(`Save failed: ${error.message}`);
      return;
    }
    navigate('/authors');
  };

  const set = (key) => (e) => setAuthor({ ...author, [key]: e.target ? e.target.value : e });

  if (loading) return <div className="p-8">Loading...</div>;

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/authors')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{id ? 'Edit Author' : 'New Author'}</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <Field label="Name (EN) *">
            <input className={inputCls} value={author.name} onChange={set('name')} placeholder="Jane Chan" />
          </Field>
          <Field label="Name (中文)">
            <input className={inputCls} value={author.name_zh || ''} onChange={set('name_zh')} placeholder="陳珍妮" />
          </Field>
          <Field label="Job title (EN)" hint='Shown in byline, e.g. "Founder & Principal Consultant"'>
            <input className={inputCls} value={author.title || ''} onChange={set('title')} />
          </Field>
          <Field label="Job title (中文)">
            <input className={inputCls} value={author.title_zh || ''} onChange={set('title_zh')} />
          </Field>
          <Field label="One-line credential (EN)" hint='E-E-A-T signal, e.g. "HKICPA, 20+ years in HK corporate services"'>
            <input className={inputCls} value={author.credential || ''} onChange={set('credential')} />
          </Field>
          <Field label="One-line credential (中文)">
            <input className={inputCls} value={author.credential_zh || ''} onChange={set('credential_zh')} />
          </Field>
          <Field label="URL slug" hint="Auto-generated from name if empty">
            <input className={inputCls} value={author.slug || ''} onChange={set('slug')} placeholder="jane-chan" />
          </Field>
          <Field label="LinkedIn URL">
            <input className={inputCls} value={author.linkedin_url || ''} onChange={set('linkedin_url')} placeholder="https://www.linkedin.com/in/..." />
          </Field>
        </div>

        <Field label="Photo URL" hint="Upload to Supabase Storage and paste the public URL">
          <input className={inputCls} value={author.photo_url || ''} onChange={set('photo_url')} />
        </Field>

        <Field label="Bio (EN)">
          <textarea className={inputCls} rows={4} value={author.bio || ''} onChange={set('bio')} />
        </Field>
        <Field label="Bio (中文)">
          <textarea className={inputCls} rows={4} value={author.bio_zh || ''} onChange={set('bio_zh')} />
        </Field>

        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={author.is_active}
            onChange={(e) => setAuthor({ ...author, is_active: e.target.checked })}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm font-medium text-gray-900">Active (visible via public API)</span>
        </label>
      </div>
    </div>
  );
}
