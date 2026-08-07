import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Edit, Trash2, Plus, History } from 'lucide-react';
import FaqAuditLogs from '../components/FaqAuditLogs';

export default function FaqList() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedFaqId, setSelectedFaqId] = useState(null);

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setFaqs(data);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this FAQ?')) {
      await supabase.from('faqs').delete().eq('id', id);
      fetchFaqs();
    }
  };

  const openLogs = (faqId = null) => {
    setSelectedFaqId(faqId);
    setShowLogs(true);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">FAQ Management</h1>
        <div className="flex gap-3">
          <button
            onClick={() => openLogs()}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <History className="w-4 h-4" />
            Audit Logs
          </button>
          <Link
            to="/faqs/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New FAQ
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 w-1/2">Question (EN)</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Updated At</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {faqs.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 line-clamp-2">{item.question_en}</div>
                    <div className="text-sm text-gray-500 mt-1 line-clamp-1">{item.question_zh}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {item.updated_at ? format(new Date(item.updated_at), 'PPp') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => openLogs(item.id)}
                        className="text-gray-500 hover:text-gray-700"
                        title="View History"
                      >
                        <History className="w-5 h-5" />
                      </button>
                      <Link
                        to={`/faqs/edit/${item.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {faqs.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                    No FAQs found. Create your first one!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showLogs && (
        <FaqAuditLogs faqId={selectedFaqId} onClose={() => setShowLogs(false)} />
      )}
    </div>
  );
}
