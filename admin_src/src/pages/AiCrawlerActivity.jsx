import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Bot, ArrowDownLeft, RefreshCw } from 'lucide-react';

/**
 * AI Crawlers & Referrals (Phase 4).
 * Shows whether AI engines' crawlers are reading the site and whether AI answers
 * are sending human visitors. Data: crawl_events table (edge middleware + beacon).
 */
export default function AiCrawlerActivity() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    setMigrationMissing(false);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('crawl_events')
      .select('kind,bot,engine,path,referer,created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      if (/relation|does not exist|schema cache/i.test(error.message || '')) setMigrationMissing(true);
      setEvents([]);
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const countBy = (key, kind) => {
    const map = {};
    events.filter((e) => e.kind === kind).forEach((e) => {
      const k = e[key] || 'unknown';
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const crawlerCounts = countBy('bot', 'crawl');
  const referralCounts = countBy('engine', 'referral');
  const recent = events.slice(0, 50);

  const StatCard = ({ title, entries, icon: Icon, empty }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-gray-500" /> {title}
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">{empty}</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-sm text-gray-700 font-mono">{name}</span>
              <span className="text-sm font-semibold text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Crawlers & Referrals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last 30 days. Crawler hits = AI engines reading your pages. Referrals = visitors arriving from AI answers.
          </p>
        </div>
        <button
          onClick={fetchEvents}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {migrationMissing && (
        <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
          The <code>crawl_events</code> table doesn't exist yet. Apply
          <code className="mx-1">supabase/migrations/20260814_phase4_crawl_events.sql</code>
          in the Supabase SQL editor to start collecting data.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatCard
          title="Crawler hits by bot"
          icon={Bot}
          entries={crawlerCounts}
          empty="No AI crawler hits recorded yet. Bots appear here once the edge middleware is deployed."
        />
        <StatCard
          title="Human visits from AI answers"
          icon={ArrowDownLeft}
          entries={referralCounts}
          empty="No AI-referred visits yet. These arrive when AI engines start citing your pages."
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Recent events</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600">Time</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600">Type</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600">Bot / Engine</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-600">Path</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recent.map((e, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {format(new Date(e.created_at), 'MMM d, HH:mm')}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${e.kind === 'crawl' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {e.kind === 'crawl' ? 'crawl' : 'referral'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm font-mono text-gray-700">{e.bot || e.engine}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 break-all">{e.path}</td>
                </tr>
              ))}
              {recent.length === 0 && !migrationMissing && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    No events in the last 30 days.
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
