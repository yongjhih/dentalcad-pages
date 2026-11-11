import React, { useState } from 'react';
import { ClinicalPhoto, CameraPreset, LocaleMode } from '../types/dental';
import { tr } from '../utils/i18n';
import {
  Maximize2,
  X,
  Compass,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Layers,
  Upload,
} from 'lucide-react';

interface PentaGalleryProps {
  photos: ClinicalPhoto[];
  onSyncCameraPreset: (preset: CameraPreset) => void;
  photoTextureMapped?: boolean;
  onTogglePhotoTexture?: () => void;
  onImportCaseFiles?: (files: FileList) => void;
  locale?: LocaleMode;
}

export const PentaGallery: React.FC<PentaGalleryProps> = ({
  photos,
  onSyncCameraPreset,
  photoTextureMapped = false,
  onTogglePhotoTexture,
  onImportCaseFiles,
  locale = 'en',
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

  const getPhotoCopy = (photo: ClinicalPhoto) => {
    const dict: Record<
      string,
      { titleZh: string; titleEn: string; viewZh: string; viewEn: string; descZh: string; descEn: string }
    > = {
      overview: {
        titleZh: '複合臨床全覽圖 (Overview)',
        titleEn: 'Composite Clinical Overview',
        viewZh: '五方位總覽 (Overview)',
        viewEn: 'Composite Penta View',
        descZh: '口掃系統匯總之五方位臨床照片集合總覽圖。',
        descEn: 'Composite 5-view intraoral clinical photography overview.',
      },
      front: {
        titleZh: '正視咬合面 (Frontal View)',
        titleEn: 'Frontal Occlusal View',
        viewZh: '正視咬合 (Frontal)',
        viewEn: 'Frontal Occlusion',
        descZh: '前牙中線、前牙覆咬與覆蓋及前牙齒列排列檢視。',
        descEn: 'Anterior midline, overjet/overbite, and frontal arch alignment.',
      },
      upper: {
        titleZh: '上顎齒列咬合面 (Upper Arch)',
        titleEn: 'Maxillary Occlusal View (Upper)',
        viewZh: '上顎咬合面 (Maxilla)',
        viewEn: 'Maxillary Occlusal',
        descZh: '上顎牙弓型態、顎面窩溝咬合點以及牙弓寬度。',
        descEn: 'Maxillary arch form, occlusal fissures, and arch width.',
      },
      lower: {
        titleZh: '下顎齒列咬合面 (Lower Arch)',
        titleEn: 'Mandibular Occlusal View (Lower)',
        viewZh: '下顎咬合面 (Mandible)',
        viewEn: 'Mandibular Occlusal',
        descZh: '下顎牙弓對稱性、舌側傾斜度及前牙擁擠分析。',
        descEn: 'Mandibular arch symmetry, lingual inclination, and anterior crowding.',
      },
      patientright: {
        titleZh: '右側頰面咬合 (Right Buccal)',
        titleEn: 'Right Buccal Occlusion',
        viewZh: '右側頰面 (Right Buccal)',
        viewEn: 'Right Buccal Occlusion',
        descZh: '右側犬齒與第一大臼齒咬合關係與齒間接觸。',
        descEn: 'Right canine and first molar occlusal relationship and intercuspation.',
      },
      patientleft: {
        titleZh: '左側頰面咬合 (Left Buccal)',
        titleEn: 'Left Buccal Occlusion',
        viewZh: '左側頰面 (Left Buccal)',
        viewEn: 'Left Buccal Occlusion',
        descZh: '左側犬齒與第一大臼齒咬合關係及後牙側方引導。',
        descEn: 'Left canine and first molar occlusal relationship and lateral guidance.',
      },
    };
    const entry = dict[photo.id];
    if (!entry) {
      return {
        title: photo.title,
        viewName: photo.viewName,
        description: photo.description,
      };
    }
    return {
      title: locale === 'en' ? entry.titleEn : entry.titleZh,
      viewName: locale === 'en' ? entry.viewEn : entry.viewZh,
      description: locale === 'en' ? entry.descEn : entry.descZh,
    };
  };

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {tr(locale, '五方位臨床齒列照片', '5-View Intraoral Clinical Photography')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            {tr(
              locale,
              '口掃系統擷取之標準臨床攝影與五方位咬合記錄 (Penta Gallery)',
              'Standard 5-view occlusal photography & 3D orthographic texture projection'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onImportCaseFiles && (
            <label
              data-testid="gallery-upload-label"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium cursor-pointer transition-colors flex-shrink-0"
            >
              <input
                type="file"
                multiple
                accept=".zip,.stl,.xml,.jpg,.jpeg,.png,.pdf,.html,application/zip,application/x-zip-compressed,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream,image/*,application/pdf,text/xml,application/xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onImportCaseFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              <Upload className="w-3.5 h-3.5" />
              <span>{tr(locale, '選擇本地照片與 STL', 'Load Intraoral Photos & STL Files')}</span>
            </label>
          )}

          {onTogglePhotoTexture && (
            <button
              onClick={onTogglePhotoTexture}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0 ${
                photoTextureMapped
                  ? 'bg-sky-500 border-sky-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {photoTextureMapped
                  ? tr(locale, '3D 照片貼圖：已啟用', '3D Photo Texture: ON')
                  : tr(locale, '套用照片貼圖至 3D 模型', 'Map Photos onto 3D Arch')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State when no local photos have been uploaded yet */}
      {photos.length === 0 ? (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b0f17] rounded-lg p-6 text-center space-y-3">
          <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
            {tr(
              locale,
              '尚未載入五方位臨床齒列照片 (純瀏覽器零隱私外洩模式)',
              'No 5-View Intraoral Clinical Photos Loaded (Zero-PHI Browser Mode)'
            )}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            {tr(
              locale,
              '本系統預設不預載任何本地病患資料。請點擊下方按鈕選擇口掃匯出的五方位臨床照片（包含 front / upper / lower / right / left 之 .jpg 或 .png 與 .stl），即可即時渲染 3D 照片貼圖並儲存於瀏覽器 IndexedDB。',
              'No local patient data is preloaded by default. Click the button below to load a .zip archive or intraoral photos (front / upper / lower / right / left .jpg/.png + .stl) for 3D texture projection.'
            )}
          </p>
          {onImportCaseFiles && (
            <label
              data-testid="gallery-upload-label"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium cursor-pointer transition-colors"
            >
              <input
                type="file"
                multiple
                accept=".zip,.stl,.xml,.jpg,.jpeg,.png,.pdf,.html,application/zip,application/x-zip-compressed,model/stl,application/sla,application/vnd.ms-pki.stl,application/octet-stream,image/*,application/pdf,text/xml,application/xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onImportCaseFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              <Upload className="w-3.5 h-3.5" />
              <span>{tr(locale, '選擇本地口掃照片與 STL 檔案', 'Load Intraoral Photos & STL Files')}</span>
            </label>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo) => {
            const copy = getPhotoCopy(photo);
            return (
              <div
                key={photo.id}
                onClick={() => handleOpenPhoto(photo)}
                className="group relative bg-white dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 hover:border-sky-500/60 rounded-lg overflow-hidden cursor-pointer transition-all flex flex-col shadow-sm dark:shadow-none"
              >
                <div className="aspect-[4/3] bg-slate-100 dark:bg-black/40 overflow-hidden relative">
                  <img
                    src={photo.src}
                    alt={copy.title}
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
                      {copy.viewName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {copy.description}
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
                      title={tr(locale, '將 3D 模型視角同步至此照片角度', 'Sync 3D camera to this photo view')}
                    >
                      <Compass className="w-3 h-3" />
                      {tr(locale, '同步 3D', 'Sync 3D')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-slate-200 z-10 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-white">
                {getPhotoCopy(selectedPhoto).title}
              </h3>
              <p className="text-xs text-slate-400">{getPhotoCopy(selectedPhoto).description}</p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => onSyncCameraPreset(selectedPhoto.cameraPreset)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
              >
                <Compass className="w-4 h-4" />
                <span>{tr(locale, '切換 3D 至此角度', 'Sync 3D View')}</span>
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                title={tr(locale, '縮小', 'Zoom Out')}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-mono text-slate-300"
                title={tr(locale, '重設縮放', 'Reset Zoom')}
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                title={tr(locale, '放大', 'Zoom In')}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 bg-slate-800 hover:bg-red-900 rounded-lg text-slate-300 hover:text-white transition-colors"
                title={tr(locale, '關閉', 'Close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center overflow-hidden my-4">
            <button
              onClick={handlePrev}
              className="absolute left-2 z-20 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
              title={tr(locale, '上一張', 'Previous')}
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
              title={tr(locale, '下一張', 'Next')}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800">
            <span className="font-mono text-[11px]">
              {tr(locale, '檔案:', 'File:')} {selectedPhoto.fileName}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={selectedPhoto.src}
                download={selectedPhoto.fileName}
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                {tr(locale, '下載原圖 (JPG)', 'Download Original (JPG)')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
