import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Edit, Trash2, Plus, UserCircle } from 'lucide-react';

export default function AuthorList() {
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuthors();
  }, []);

  const fetchAuthors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('authors')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setAuthors(data);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this author? Articles will keep their text but lose the byline.')) {
      await supabase.from('authors').delete().eq('id', id);
      fetchAuthors();
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Authors</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real named authors with credentials power E-E-A-T bylines on every article.
          </p>
        </div>
        <Link
          to="/authors/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Author
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Author</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Title / Credential</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {authors.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {a.photo_url ? (
                        <img src={a.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <UserCircle className="w-9 h-9 text-gray-300" />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{a.name}</div>
                        {a.name_zh && <div className="text-sm text-gray-500">{a.name_zh}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{a.title || '-'}</div>
                    <div className="text-sm text-gray-500">{a.credential || ''}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <Link to={`/authors/edit/${a.id}`} className="text-blue-600 hover:text-blue-800">
                        <Edit className="w-5 h-5" />
                      </Link>
                      <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:text-red-800">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {authors.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    No authors yet. Add your first team member to enable article bylines.
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
