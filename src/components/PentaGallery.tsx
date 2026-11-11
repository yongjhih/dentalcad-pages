import React, { useState } from 'react';
import { ClinicalPhoto, CameraPreset } from '../types/dental';
import {
  Maximize2,
  X,
  Compass,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface PentaGalleryProps {
  photos: ClinicalPhoto[];
  onSyncCameraPreset: (preset: CameraPreset) => void;
  photoTextureMapped?: boolean;
  onTogglePhotoTexture?: () => void;
}

export const PentaGallery: React.FC<PentaGalleryProps> = ({
  photos,
  onSyncCameraPreset,
  photoTextureMapped = false,
  onTogglePhotoTexture,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<ClinicalPhoto | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const handleOpenPhoto = (photo: ClinicalPhoto) => {
    setSelectedPhoto(photo);
    setZoomLevel(1);
  };

  const handleClose = () => {
    setSelectedPhoto(null);
    setZoomLevel(1);
  };

  const handleNext = () => {
    if (!selectedPhoto || photos.length === 0) return;
    const currentIndex = photos.findIndex((p) => p.id === selectedPhoto.id);
    const nextIndex = (currentIndex + 1) % photos.length;
    setSelectedPhoto(photos[nextIndex]);
    setZoomLevel(1);
  };

  const handlePrev = () => {
    if (!selectedPhoto || photos.length === 0) return;
    const currentIndex = photos.findIndex((p) => p.id === selectedPhoto.id);
    const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
    setSelectedPhoto(photos[prevIndex]);
    setZoomLevel(1);
  };

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            五方位臨床齒列照片
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            iTero Element 系統擷取之標準臨床攝影與五方位咬合記錄 (Penta Gallery)
          </p>
        </div>

        {onTogglePhotoTexture && (
          <button
            onClick={onTogglePhotoTexture}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              photoTextureMapped
                ? 'bg-sky-500 border-sky-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{photoTextureMapped ? '3D 照片貼圖：已啟用' : '套用照片貼圖至 3D 模型'}</span>
          </button>
        )}
      </div>

      {/* Grid of photos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo) => (
          <div
            key={photo.id}
            onClick={() => handleOpenPhoto(photo)}
            className="group relative bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 hover:border-sky-500/60 rounded-lg overflow-hidden cursor-pointer transition-all flex flex-col shadow-sm dark:shadow-none"
          >
            <div className="aspect-[4/3] bg-slate-100 dark:bg-black/40 overflow-hidden relative">
              <img
                src={photo.src}
                alt={photo.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-30 group-hover:opacity-20 transition-opacity" />
              <div className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="p-2.5 flex-1 flex flex-col justify-between">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                  {photo.viewName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {photo.description}
                </p>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {photo.fileName}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSyncCameraPreset(photo.cameraPreset);
                  }}
                  className="flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium px-1.5 py-0.5 rounded bg-sky-500/10 dark:bg-sky-950/50 border border-sky-500/30 dark:border-sky-800/40"
                  title="將 3D 模型視角同步至此照片角度"
                >
                  <Compass className="w-3 h-3" />
                  同步 3D
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-slate-200 z-10 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-white">{selectedPhoto.title}</h3>
              <p className="text-xs text-slate-400">{selectedPhoto.description}</p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => onSyncCameraPreset(selectedPhoto.cameraPreset)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
              >
                <Compass className="w-4 h-4" />
                <span>切換 3D 至此角度</span>
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                title="縮小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-mono text-slate-300"
                title="重設縮放"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                title="放大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 bg-slate-800 hover:bg-red-900 rounded-lg text-slate-300 hover:text-white transition-colors"
                title="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center overflow-hidden my-4">
            <button
              onClick={handlePrev}
              className="absolute left-2 z-20 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
              title="上一張"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="max-w-full max-h-full flex items-center justify-center overflow-auto p-2">
              <img
                src={selectedPhoto.src}
                alt={selectedPhoto.title}
                style={{ transform: `scale(${zoomLevel})` }}
                className="max-h-[75vh] max-w-full object-contain rounded-md transition-transform duration-200 shadow-2xl"
              />
            </div>

            <button
              onClick={handleNext}
              className="absolute right-2 z-20 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
              title="下一張"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800">
            <span className="font-mono text-[11px]">檔案: {selectedPhoto.fileName}</span>
            <div className="flex items-center gap-2">
              <a
                href={selectedPhoto.src}
                download={selectedPhoto.fileName}
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                下載原圖 (JPG)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
