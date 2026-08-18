import React, { useState, useMemo } from 'react';
import { X, Monitor, Tablet, Smartphone } from 'lucide-react';
import clsx from 'clsx';
import { sanitizeHtml } from '../lib/sanitize';

export default function ArticlePreviewDialog({ article, onClose }) {
  const [device, setDevice] = useState('desktop');
  const [lang, setLang] = useState('en');

  const title = article[`title_${lang}`] || article.title_en || 'Untitled';
  const excerpt = article[`excerpt_${lang}`] || article.excerpt_en || 'No excerpt';
  const content = useMemo(
    () => sanitizeHtml(article[`content_${lang}`] || article.content_en || ''),
    [article, lang]
  );
  
  // Try to use the first image's crop if available, else original URL
  let coverStyle = {};
  let coverUrl = article.cover_image_url;
  
  if (article.images && article.images.length > 0) {
    const firstImg = article.images[0];
    coverUrl = firstImg.url;
    if (firstImg.cropData) {
      const { crop, zoom } = firstImg.cropData;
      // In a real advanced implementation, we would apply CSS transform here based on the percentage
      // For the preview, we'll approximate it with object-position if possible, 
      // but react-easy-crop gives us pixel values which are harder to map to CSS without knowing container size.
      // We'll just show the image with object-cover for this preview.
    }
  }

  const deviceStyles = {
    desktop: 'max-w-5xl w-full',
    tablet: 'max-w-2xl w-full',
    mobile: 'max-w-sm w-full',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 p-4">
      <div className="bg-gray-100 rounded-xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h3 className="font-semibold text-gray-900">Live Preview</h3>
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setDevice('desktop')} className={clsx("p-1.5 rounded-md", device === 'desktop' ? 'bg-white shadow' : 'text-gray-500')}><Monitor className="w-4 h-4" /></button>
              <button onClick={() => setDevice('tablet')} className={clsx("p-1.5 rounded-md", device === 'tablet' ? 'bg-white shadow' : 'text-gray-500')}><Tablet className="w-4 h-4" /></button>
              <button onClick={() => setDevice('mobile')} className={clsx("p-1.5 rounded-md", device === 'mobile' ? 'bg-white shadow' : 'text-gray-500')}><Smartphone className="w-4 h-4" /></button>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-lg text-sm">
              <button onClick={() => setLang('en')} className={clsx("px-3 py-1 rounded-md", lang === 'en' ? 'bg-white shadow font-medium' : 'text-gray-500')}>EN</button>
              <button onClick={() => setLang('zh')} className={clsx("px-3 py-1 rounded-md", lang === 'zh' ? 'bg-white shadow font-medium' : 'text-gray-500')}>繁</button>
              <button onClick={() => setLang('zh_cn')} className={clsx("px-3 py-1 rounded-md", lang === 'zh_cn' ? 'bg-white shadow font-medium' : 'text-gray-500')}>简</button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center items-start">
          <div className={clsx("bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden transition-all duration-300", deviceStyles[device])}>
            {/* List Item Preview */}
            <div className="p-6 border-b-8 border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">List View Preview</p>
              <div className="flex gap-6">
                <div className="w-1/3 aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden">
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Cover</div>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">{title}</h2>
                  <p className="text-gray-500 text-sm line-clamp-3 leading-relaxed">{excerpt}</p>
                </div>
              </div>
            </div>

            {/* Detail Page Preview */}
            <div className="p-8">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Detail View Preview</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">{title}</h1>
              {coverUrl && (
                <div className="w-full aspect-[16/9] bg-gray-100 rounded-xl overflow-hidden mb-8">
                  <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="prose prose-blue max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
