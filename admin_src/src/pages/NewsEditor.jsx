import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { supabase } from '../lib/supabase';
import { Image as ImageIcon, Save, ArrowLeft, Eye, LayoutTemplate } from 'lucide-react';
import clsx from 'clsx';
import DraggableImageList from '../components/DraggableImageList';
import ImageCropperDialog from '../components/ImageCropperDialog';
import ArticlePreviewDialog from '../components/ArticlePreviewDialog';

const LANGS = [
  { id: 'en', label: 'English' },
  { id: 'zh', label: '繁體中文' },
  { id: 'zh_cn', label: '简体中文' }
];

export default function NewsEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [activeLang, setActiveLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [article, setArticle] = useState({
    slug: '',
    category: 'news',
    is_published: false,
    publish_time: new Date().toISOString().slice(0, 16),
    title_en: '', excerpt_en: '', content_en: '',
    title_zh: '', excerpt_zh: '', content_zh: '',
    title_zh_cn: '', excerpt_zh_cn: '', content_zh_cn: '',
    images: [] // Virtual field for UI: [{ id, url, name, cropData }]
  });

  const [cropImage, setCropImage] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (id) fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('news_activities')
      .select('*')
      .eq('id', id)
      .single();
      
    if (data) {
      let images = [];
      try {
        images = typeof data.images_metadata === 'string' ? JSON.parse(data.images_metadata) : data.images_metadata || [];
      } catch(e) {}
      
      setArticle({
        ...data,
        publish_time: data.publish_time ? new Date(data.publish_time).toISOString().slice(0, 16) : '',
        images
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    
    // Auto-generate slug if empty
    let finalSlug = article.slug;
    if (!finalSlug && article.title_en) {
      finalSlug = article.title_en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    if (!finalSlug) finalSlug = `article-${Date.now()}`;

    const payload = {
      slug: finalSlug,
      category: article.category,
      is_published: article.is_published,
      publish_time: new Date(article.publish_time).toISOString(),
      title_en: article.title_en, excerpt_en: article.excerpt_en, content_en: article.content_en,
      title_zh: article.title_zh, excerpt_zh: article.excerpt_zh, content_zh: article.content_zh,
      title_zh_cn: article.title_zh_cn, excerpt_zh_cn: article.excerpt_zh_cn, content_zh_cn: article.content_zh_cn,
      images_metadata: article.images,
      cover_image_url: article.images.length > 0 ? article.images[0].url : null
    };

    if (id) {
      await supabase.from('news_activities').update(payload).eq('id', id);
    } else {
      const { data } = await supabase.from('news_activities').insert([payload]).select().single();
      if (data) navigate(`/news/edit/${data.id}`, { replace: true });
    }
    
    setSaving(false);
    alert('Saved successfully');
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    if (article.images.length + files.length > 5) {
      alert('Maximum 5 images allowed per article.');
      return;
    }

    const newImages = [...article.images];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('news_images')
        .upload(filePath, file);

      if (!uploadError) {
        const { data } = supabase.storage.from('news_images').getPublicUrl(filePath);
        newImages.push({
          id: fileName,
          url: data.publicUrl,
          name: file.name,
          cropData: null
        });
      }
    }
    
    setArticle(prev => ({ ...prev, images: newImages }));
  };

  const handleCropComplete = (cropData) => {
    setArticle(prev => ({
      ...prev,
      images: prev.images.map(img => 
        img.id === cropImage.id ? { ...img, cropData } : img
      )
    }));
    setCropImage(null);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/news')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{id ? 'Edit Article' : 'New Article'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 flex items-center gap-2"
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Editor */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Meta Card */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                <input
                  type="text"
                  value={article.slug}
                  onChange={e => setArticle({...article, slug: e.target.value})}
                  placeholder="Auto-generated if empty"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={article.category}
                  onChange={e => setArticle({...article, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="news">News & Activities</option>
                  <option value="education">Education</option>
                  <option value="charity">Charity</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publish Time</label>
                <input
                  type="datetime-local"
                  value={article.publish_time}
                  onChange={e => setArticle({...article, publish_time: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={article.is_published}
                    onChange={e => setArticle({...article, is_published: e.target.checked})}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900">Publish Immediately</span>
                </label>
              </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={article[`title_${activeLang}`]}
                    onChange={e => setArticle({...article, [`title_${activeLang}`]: e.target.value})}
                    className="w-full px-3 py-2 text-lg font-medium border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Article Title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
                  <textarea
                    value={article[`excerpt_${activeLang}`]}
                    onChange={e => setArticle({...article, [`excerpt_${activeLang}`]: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Short summary for list views..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <div className="h-[400px] mb-12">
                    <ReactQuill 
                      theme="snow" 
                      value={article[`content_${activeLang}`]} 
                      onChange={val => setArticle({...article, [`content_${activeLang}`]: val})}
                      className="h-full"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right: Media Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Media Gallery
            </h2>
            <p className="text-xs text-gray-500 mt-1">First image is used as cover. Drag to reorder.</p>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto">
            <DraggableImageList
              images={article.images}
              onReorder={imgs => setArticle({...article, images: imgs})}
              onRemove={id => setArticle({...article, images: article.images.filter(i => i.id !== id)})}
              onCrop={img => setCropImage(img)}
            />
            
            <label className="mt-4 flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500"><span className="font-semibold">Click to upload</span></p>
                <p className="text-xs text-gray-500 mt-1">Max 5 images</p>
              </div>
              <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>
        </div>
      </div>

      {cropImage && (
        <ImageCropperDialog
          image={cropImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImage(null)}
        />
      )}

      {showPreview && (
        <ArticlePreviewDialog
          article={article}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
