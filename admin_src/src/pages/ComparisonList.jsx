import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Edit, Trash2, Plus, Scale } from 'lucide-react';

export default function ComparisonList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('comparisons')
      .select('id,slug,competitor_name,title_en,is_published,last_reviewed_at,updated_at')
      .order('updated_at', { ascending: false });
    if (!error && data) setItems(data);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this comparison page?')) {
      await supabase.from('comparisons').delete().eq('id', id);
      fetchItems();
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comparison Pages</h1>
          <p className="text-sm text-gray-500 mt-1">
            "Leap vs [competitor]" content — the format AI engines cite most for decision-stage queries.
          </p>
        </div>
        <Link
          to="/comparisons/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Comparison
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Comparison</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Slug</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Last reviewed</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Scale className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">vs {item.competitor_name}</div>
                        <div className="text-sm text-gray-500 line-clamp-1">{item.title_en}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.slug}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${item.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.is_published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {item.last_reviewed_at ? format(new Date(item.last_reviewed_at), 'PP') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <Link to={`/comparisons/edit/${item.id}`} className="text-blue-600 hover:text-blue-800">
                        <Edit className="w-5 h-5" />
                      </Link>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No comparison pages yet — this is the site's biggest GEO gap (audit score 0/100).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
