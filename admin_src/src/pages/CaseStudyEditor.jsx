import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Save, ArrowLeft } from 'lucide-react';

const EMPTY = {
  slug: '', client_name: '', client_label_en: '', client_label_zh: '', industry: '',
  title_en: '', title_zh: '', summary_en: '', summary_zh: '', body_en: '', body_zh: '',
  metrics: [], quote: '', quote_author: '', services: [],
  is_published: false, published_at: '',
};

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500';

function JsonField({ label, hint, value, onChange, rows = 4 }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? [], null, 2));
  const [valid, setValid] = useState(true);

  useEffect(() => {
    setText(JSON.stringify(value ?? [], null, 2));
  }, [value]);

  const handle = (e) => {
    const v = e.target.value;
    setText(v);
    try {
      onChange(JSON.parse(v));
      setValid(true);
    } catch {
      setValid(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        className={`${inputCls} font-mono text-xs ${valid ? '' : 'border-red-400 bg-red-50'}`}
        rows={rows}
        value={text}
        onChange={handle}
        spellCheck={false}
      />
      {!valid && <p className="text-xs text-red-500 mt-1">Invalid JSON — changes to this field won't be saved.</p>}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function CaseStudyEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(EMPTY);
  const [servicesText, setServicesText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      setLoading(true);
      supabase.from('case_studies').select('*').eq('id', id).single().then(({ data }) => {
        if (data) {
          setItem({ ...EMPTY, ...data, published_at: data.published_at ? data.published_at.slice(0, 10) : '' });
          setServicesText((data.services || []).join(', '));
        }
        setLoading(false);
      });
    }
  }, [id]);

  const handleSave = async () => {
    if (!item.title_en.trim() || !item.client_label_en.trim()) {
      alert('English title and client label are required.');
      return;
    }
    setSaving(true);
    const payload = { ...item };
    if (!payload.slug) {
      payload.slug = payload.title_en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '').slice(0, 80);
    }
    payload.services = servicesText.split(',').map((s) => s.trim()).filter(Boolean);
    payload.published_at = payload.published_at ? new Date(payload.published_at).toISOString() : null;
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    let error;
    if (id) {
      ({ error } = await supabase.from('case_studies').update(payload).eq('id', id));
    } else {
      ({ error } = await supabase.from('case_studies').insert([payload]));
    }
    setSaving(false);
    if (error) {
      alert(`Save failed: ${error.message}`);
      return;
    }
    navigate('/case-studies');
  };

  const set = (key) => (e) => setItem({ ...item, [key]: e.target.value });

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/case-studies')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{id ? 'Edit Case Study' : 'New Case Study'}</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client label (EN) *</label>
            <input className={inputCls} value={item.client_label_en} onChange={set('client_label_en')} placeholder="Singaporean e-commerce founder" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client label (中文)</label>
            <input className={inputCls} value={item.client_label_zh || ''} onChange={set('client_label_zh')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client name (optional)</label>
            <input className={inputCls} value={item.client_name || ''} onChange={set('client_name')} placeholder="Only with written client permission" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <input className={inputCls} value={item.industry || ''} onChange={set('industry')} placeholder="E-commerce" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (EN) *</label>
            <input className={inputCls} value={item.title_en} onChange={set('title_en')} placeholder="How a Singaporean founder incorporated in HK in 3 days" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (中文)</label>
            <input className={inputCls} value={item.title_zh || ''} onChange={set('title_zh')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input className={inputCls} value={item.slug} onChange={set('slug')} placeholder="Auto-generated if empty" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publish date</label>
            <input type="date" className={inputCls} value={item.published_at || ''} onChange={set('published_at')} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Services used (comma-separated)</label>
            <input className={inputCls} value={servicesText} onChange={(e) => setServicesText(e.target.value)} placeholder="incorporation, corporate secretary, accounting" />
          </div>
          <label className="flex items-center cursor-pointer col-span-2">
            <input
              type="checkbox"
              checked={item.is_published}
              onChange={(e) => setItem({ ...item, is_published: e.target.checked })}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm font-medium text-gray-900">Published (visible via public API)</span>
          </label>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <JsonField
            label="Metrics (real numbers — the part AI engines quote)"
            hint='[{"label":"Incorporation time","value":"3 business days"},{"label":"First-year cost","value":"HK$8,800"}]'
            value={item.metrics}
            onChange={(v) => setItem({ ...item, metrics: v })}
          />
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary (EN)</label>
              <textarea className={inputCls} rows={3} value={item.summary_en || ''} onChange={set('summary_en')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary (中文)</label>
              <textarea className={inputCls} rows={3} value={item.summary_zh || ''} onChange={set('summary_zh')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body (EN)</label>
              <textarea className={inputCls} rows={6} value={item.body_en || ''} onChange={set('body_en')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body (中文)</label>
              <textarea className={inputCls} rows={6} value={item.body_zh || ''} onChange={set('body_zh')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client quote</label>
              <textarea className={inputCls} rows={3} value={item.quote || ''} onChange={set('quote')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quote author</label>
              <input className={inputCls} value={item.quote_author || ''} onChange={set('quote_author')} placeholder="Name, role (with permission)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
