import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';
import { format } from 'date-fns';

export default function FaqAuditLogs({ faqId, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [faqId]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase.from('faq_audit_logs').select('*').order('created_at', { ascending: false });
    
    if (faqId) {
      query = query.eq('faq_id', faqId);
    }
    
    const { data } = await query;
    if (data) setLogs(data);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/50">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-slide-in-right">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-900">
            {faqId ? 'FAQ Revision History' : 'All FAQ Audit Logs'}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">
          {loading ? (
            <div className="text-center text-gray-500 py-10">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-gray-500 py-10">No audit logs found.</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                      log.action === 'INSERT' ? 'bg-green-100 text-green-700' :
                      log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-sm text-gray-500 font-mono text-xs">{log.faq_id}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {format(new Date(log.created_at), 'PPp')}
                  </div>
                </div>
                
                <div className="p-4 space-y-4">
                  {log.action === 'UPDATE' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Before</p>
                        <pre className="text-xs bg-red-50 text-red-900 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.old_data, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">After</p>
                        <pre className="text-xs bg-green-50 text-green-900 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {log.action === 'INSERT' && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-2">Inserted Data</p>
                      <pre className="text-xs bg-gray-50 text-gray-800 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.new_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {log.action === 'DELETE' && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-2">Deleted Data</p>
                      <pre className="text-xs bg-gray-50 text-gray-500 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.old_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
