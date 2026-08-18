import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Save, ArrowLeft } from 'lucide-react';

const EMPTY = {
  slug: '', competitor_name: '', competitor_url: '',
  title_en: '', title_zh: '', summary_en: '', summary_zh: '',
  comparison_rows: [], choose_leap_if: [], choose_competitor_if: [], faq_items: [],
  is_published: false, last_reviewed_at: '',
};

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500';

/** Textarea that edits a JSON array/object with validity feedback. */
function JsonField({ label, hint, value, onChange, rows = 5 }) {
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

export default function ComparisonEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      setLoading(true);
      supabase.from('comparisons').select('*').eq('id', id).single().then(({ data }) => {
        if (data) setItem({ ...EMPTY, ...data, last_reviewed_at: data.last_reviewed_at || '' });
        setLoading(false);
      });
    }
  }, [id]);

  const handleSave = async () => {
    if (!item.competitor_name.trim() || !item.title_en.trim()) {
      alert('Competitor name and English title are required.');
      return;
    }
    setSaving(true);
    const payload = { ...item };
    if (!payload.slug) {
      payload.slug = `leap-vs-${payload.competitor_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}`;
    }
    payload.last_reviewed_at = payload.last_reviewed_at || null;
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    let error;
    if (id) {
      ({ error } = await supabase.from('comparisons').update(payload).eq('id', id));
    } else {
      ({ error } = await supabase.from('comparisons').insert([payload]));
    }
    setSaving(false);
    if (error) {
      alert(`Save failed: ${error.message}`);
      return;
    }
    navigate('/comparisons');
  };

  const set = (key) => (e) => setItem({ ...item, [key]: e.target.value });

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/comparisons')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{id ? 'Edit Comparison' : 'New Comparison'}</h1>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Competitor name *</label>
            <input className={inputCls} value={item.competitor_name} onChange={set('competitor_name')} placeholder="Tricor Services Limited" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Competitor URL</label>
            <input className={inputCls} value={item.competitor_url || ''} onChange={set('competitor_url')} placeholder="https://tricorglobal.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input className={inputCls} value={item.slug} onChange={set('slug')} placeholder="leap-vs-tricor (auto if empty)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last reviewed date</label>
            <input type="date" className={inputCls} value={item.last_reviewed_at || ''} onChange={set('last_reviewed_at')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (EN) *</label>
            <input className={inputCls} value={item.title_en} onChange={set('title_en')} placeholder="Leap International vs Tricor: which fits you?" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (中文)</label>
            <input className={inputCls} value={item.title_zh || ''} onChange={set('title_zh')} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Answer-first summary (EN)</label>
            <textarea className={inputCls} rows={3} value={item.summary_en || ''} onChange={set('summary_en')} placeholder="One-paragraph direct answer: who should choose which, and why." />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Answer-first summary (中文)</label>
            <textarea className={inputCls} rows={3} value={item.summary_zh || ''} onChange={set('summary_zh')} />
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
            label="Comparison rows (8–15 recommended)"
            hint='[{"dimension":"Pricing transparency","leap":"Published packages from HK$3,500","competitor":"Quote only"}]'
            value={item.comparison_rows}
            onChange={(v) => setItem({ ...item, comparison_rows: v })}
            rows={8}
          />
          <div className="grid grid-cols-2 gap-6">
            <JsonField
              label="Choose Leap if…"
              hint='["You want founder-led, personal service", ...]'
              value={item.choose_leap_if}
              onChange={(v) => setItem({ ...item, choose_leap_if: v })}
            />
            <JsonField
              label="Choose competitor if… (be honest — objectivity gets cited)"
              hint='["You need offices in 40+ countries", ...]'
              value={item.choose_competitor_if}
              onChange={(v) => setItem({ ...item, choose_competitor_if: v })}
            />
          </div>
          <JsonField
            label="FAQ items (5–8 recommended)"
            hint='[{"question_en":"Is Leap a good alternative to Tricor?","answer_en":"...","question_zh":"...","answer_zh":"..."}]'
            value={item.faq_items}
            onChange={(v) => setItem({ ...item, faq_items: v })}
            rows={7}
          />
        </div>
      </div>
    </div>
  );
}
