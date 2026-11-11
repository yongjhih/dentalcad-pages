import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  X,
  Send,
  Settings,
  ExternalLink,
  Terminal,
  Activity,
  Eye,
  Plug,
  BarChart2,
  Trash2,
} from 'lucide-react';
import {
  DentalCaseBundle,
  LocaleMode,
  OcclusogramStats,
  OrthoArchMetrics,
  ViewportSettings,
  CameraPreset,
  ShadingMode,
} from '../types/dental';
import { tr } from '../utils/i18n';

export interface ViewerControlPayload {
  cameraPreset?: CameraPreset;
  shadingMode?: ShadingMode;
  occlusogramEnabled?: boolean;
  articulationMode?: 'hinge' | 'protrusion' | 'lateral_left' | 'lateral_right' | 'chewing' | 'parallel';
  articulationProgress?: number;
  occlusionSeparation?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: Array<{
    label: string;
    type: 'add-mcp' | 'open-mcp' | 'open-covpages' | 'viewer-control';
    url?: string;
    control?: ViewerControlPayload;
  }>;
}

interface AskAiDrawerProps {
  open: boolean;
  onClose: () => void;
  locale: LocaleMode;
  activeCase: DentalCaseBundle;
  archMetrics: OrthoArchMetrics;
  occlusogramStats: OcclusogramStats;
  viewportSettings: ViewportSettings;
  cameraPreset: CameraPreset;
  onApplyViewerControl: (payload: ViewerControlPayload) => void;
}

const ENDPOINT_STORAGE_KEY = 'dentalcad_ai_proxy_endpoint';
const DEFAULT_AI_PROXY_ENDPOINT = 'http://127.0.0.1:8788';
const MCP_PAGE_CANONICAL_URL = 'https://yongjhih.github.io/dentalcad-pages/mcp';

export const AskAiDrawer: React.FC<AskAiDrawerProps> = ({
  open,
  onClose,
  locale,
  activeCase,
  archMetrics,
  occlusogramStats,
  viewportSettings,
  cameraPreset,
  onApplyViewerControl,
}) => {
  const [endpoint, setEndpoint] = useState<string>(() => {
    try {
      return localStorage.getItem(ENDPOINT_STORAGE_KEY) || DEFAULT_AI_PROXY_ENDPOINT;
    } catch {
      return DEFAULT_AI_PROXY_ENDPOINT;
    }
  });
  const [draftEndpoint, setDraftEndpoint] = useState<string>(endpoint);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [relayOnline, setRelayOnline] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const buildWelcomeMessage = useCallback(
    (loc: LocaleMode): ChatMessage => ({
      id: 'welcome',
      role: 'assistant',
      content: tr(
        loc,
        `您好！我是 **DentalCAD Pages AI 助手**（支援 \`ai-proxy\` 本地 \`/v1/chat/completions\` 與 **MCP Pages** 工具）。\n\n您可以詢問齒弓測量數據、6-DOF 虛擬咬合器分析、測試覆蓋率（covpages），或直接在對話中控制 3D 檢視器。`,
        `Hello! I am the **DentalCAD Pages AI Assistant** (powered by local \`ai-proxy\` \`/v1/chat/completions\` & **MCP Pages** WebMCP tools).\n\nAsk me about orthodontic arch metrics, 6-DOF mandibular articulation, test coverage (covpages), or control the 3D CAD viewer directly from chat.`
      ),
      actions: [
        {
          label: tr(loc, '➕ 一鍵新增到 local ai-proxy', '➕ One-Click Add to local ai-proxy'),
          type: 'add-mcp',
          url: MCP_PAGE_CANONICAL_URL,
        },
        {
          label: tr(loc, '🔌 開啟 MCP Page (mcp.html)', '🔌 Open MCP Page (mcp.html)'),
          type: 'open-mcp',
          url: 'mcp.html',
        },
        {
          label: tr(loc, '📊 測試覆蓋率 (covpages)', '📊 Coverage Report (covpages)'),
          type: 'open-covpages',
          url: 'covpages/',
        },
      ],
    }),
    []
  );

  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage(locale)]);

  // Probe local ai-proxy status when drawer opens or endpoint changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    fetch(`${endpoint.replace(/\/+$/, '')}/v1/models`, {
      method: 'GET',
      signal: controller.signal,
    })
      .then((res) => {
        if (!cancelled) setRelayOnline(res.ok || res.status === 401 || res.status === 403);
      })
      .catch(() => {
        if (!cancelled) setRelayOnline(false);
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, endpoint]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const generateLocalReply = useCallback(
    (query: string): Omit<ChatMessage, 'id'> => {
      const q = query.trim().toLowerCase();

      // 1. MCP / ai-proxy / WebMCP questions
      if (q.includes('mcp') || q.includes('ai-proxy') || q.includes('proxy') || q.includes('claude')) {
        return {
          role: 'assistant',
          content: tr(
            locale,
            `本站內建符合 **MCP Pages** 規範的靜態端點 (\`mcp.html\`)，透過 \`navigator.modelContext\` 註冊 5 項牙科 CAD 工具：\n- \`dentalcad_get_overview\`\n- \`dentalcad_list_cases\`\n- \`dentalcad_compute_articulation\`\n- \`dentalcad_analyze_arch_metrics\`\n- \`dentalcad_control_viewer\`\n\nCLI 註冊指令：\n\`npx ai-proxy add ${MCP_PAGE_CANONICAL_URL} --name dentalcad\`\n\n[➕ 一鍵新增到 local ai-proxy](action:add-mcp?url=${MCP_PAGE_CANONICAL_URL})`,
            `This site includes a compliant **MCP Pages** endpoint (\`mcp.html\`) registering 5 client-side WebMCP tools on \`navigator.modelContext\`:\n- \`dentalcad_get_overview\`\n- \`dentalcad_list_cases\`\n- \`dentalcad_compute_articulation\`\n- \`dentalcad_analyze_arch_metrics\`\n- \`dentalcad_control_viewer\`\n\nRegister via CLI:\n\`npx ai-proxy add ${MCP_PAGE_CANONICAL_URL} --name dentalcad\`\n\n[➕ One-Click Add to local ai-proxy](action:add-mcp?url=${MCP_PAGE_CANONICAL_URL})`
          ),
          actions: [
            {
              label: tr(locale, '➕ 一鍵新增到 local ai-proxy', '➕ One-Click Add to local ai-proxy'),
              type: 'add-mcp',
              url: MCP_PAGE_CANONICAL_URL,
            },
            {
              label: tr(locale, '🔌 開啟 mcp.html', '🔌 Open mcp.html'),
              type: 'open-mcp',
              url: 'mcp.html',
            },
          ],
        };
      }

      // 2. Coverage / covpages questions
      if (q.includes('cov') || q.includes('coverage') || q.includes('覆蓋率') || q.includes('測試')) {
        return {
          role: 'assistant',
          content: tr(
            locale,
            `本專案整合 **covpages** 產生 GitHub Primer 風格的單元與整合測試覆蓋率報告（支援多 Commit 趨勢圖與 \`covpages/mcp.html\` WebMCP 查詢端點）。\n\n您可點擊下方按鈕直接開啟覆蓋率報告：`,
            `This repository integrates **covpages** for GitHub Primer-styled unit & integration test coverage reports (with multi-commit trend graphs and \`covpages/mcp.html\` WebMCP tools).\n\nClick below to view the live coverage report:`
          ),
          actions: [
            {
              label: tr(locale, '📊 開啟 covpages 測試覆蓋率報告', '📊 Open covpages Coverage Report'),
              type: 'open-covpages',
              url: 'covpages/',
            },
          ],
        };
      }

      // 3. Occlusogram / Heatmap control intent
      if (q.includes('heatmap') || q.includes('occlusogram') || q.includes('熱力圖') || q.includes('咬合接觸')) {
        onApplyViewerControl({ occlusogramEnabled: true });
        return {
          role: 'assistant',
          content: tr(
            locale,
            `已為您開啟 **咬合接觸熱力圖 (Occlusogram)**！\n- 最小咬合間隙：**${occlusogramStats.minClearanceMm.toFixed(2)} mm**\n- 接觸面積 (<0.5mm)：**${occlusogramStats.contactAreaMm2.toFixed(1)} mm²**\n- 左右分布：**L ${occlusogramStats.leftContactPercent}% / R ${occlusogramStats.rightContactPercent}%**`,
            `Enabled the **Occlusogram Contact Heatmap** in the 3D viewport!\n- Min Clearance: **${occlusogramStats.minClearanceMm.toFixed(2)} mm**\n- Contact Area (<0.5mm): **${occlusogramStats.contactAreaMm2.toFixed(1)} mm²**\n- L/R Balance: **L ${occlusogramStats.leftContactPercent}% / R ${occlusogramStats.rightContactPercent}%**`
          ),
          actions: [
            {
              label: tr(locale, '關閉熱力圖', 'Disable Heatmap'),
              type: 'viewer-control',
              control: { occlusogramEnabled: false },
            },
          ],
        };
      }

      // 4. Protrusion / Articulation Excursion intent
      if (
        q.includes('protrus') ||
        q.includes('articulator') ||
        q.includes('excursion') ||
        q.includes('前突') ||
        q.includes('下顎運動') ||
        q.includes('咬合器')
      ) {
        onApplyViewerControl({ articulationMode: 'protrusion', articulationProgress: 0.6 });
        return {
          role: 'assistant',
          content: tr(
            locale,
            `已在 3D 檢視器套用 **6-DOF 下顎前突運動模擬**（模式：前突 \`protrusion\`、行程進度 **60%**、髁頭導引角 **${viewportSettings.articulator.condylarGuidanceAngleDeg}°**）。`,
            `Applied **6-DOF Mandibular Protrusive Excursion** in the 3D viewport (Mode: \`protrusion\`, Progress: **60%**, Condylar Guidance **${viewportSettings.articulator.condylarGuidanceAngleDeg}°**).`
          ),
          actions: [
            {
              label: tr(locale, '重設中心咬合 (CO/MIP)', 'Reset to CO (0%)'),
              type: 'viewer-control',
              control: { articulationMode: 'hinge', articulationProgress: 0 },
            },
          ],
        };
      }

      // 5. Default Clinical & Arch Summary
      const vendor = activeCase.metadata.scannerVendor || 'Universal IOS';
      return {
        role: 'assistant',
        content: tr(
          locale,
          `目前載入病例 **#${activeCase.metadata.orderId}**（掃描設備：\`${vendor}\`）的臨床與齒弓摘要：\n- **齒弓寬度**：U3-U3 尖牙間寬 **${archMetrics.upperIntercanineWidthMm.toFixed(1)} mm** / U6-U6 大臼齒間寬 **${archMetrics.upperIntermolarWidthMm.toFixed(1)} mm**\n- **前牙關係**：Overjet **${archMetrics.overjetMm.toFixed(1)} mm** · Overbite **${archMetrics.overbiteMm.toFixed(1)} mm**\n- **最小咬合間隙**：**${occlusogramStats.minClearanceMm.toFixed(2)} mm**（接觸面積 **${occlusogramStats.contactAreaMm2.toFixed(1)} mm²**）\n- **目前 3D 視角 / 材質**：\`${cameraPreset}\` / \`${viewportSettings.shadingMode}\``,
          `Clinical & orthodontic summary for active case **#${activeCase.metadata.orderId}** (Scanner: \`${vendor}\`):\n- **Arch Width**: U3-U3 Intercanine **${archMetrics.upperIntercanineWidthMm.toFixed(1)} mm** / U6-U6 Intermolar **${archMetrics.upperIntermolarWidthMm.toFixed(1)} mm**\n- **Anterior Relation**: Overjet **${archMetrics.overjetMm.toFixed(1)} mm** · Overbite **${archMetrics.overbiteMm.toFixed(1)} mm**\n- **Min Occlusal Clearance**: **${occlusogramStats.minClearanceMm.toFixed(2)} mm** (Contact Area **${occlusogramStats.contactAreaMm2.toFixed(1)} mm²**)\n- **Active Viewport / Shader**: \`${cameraPreset}\` / \`${viewportSettings.shadingMode}\``
        ),
        actions: [
          {
            label: tr(locale, '🔥 開啟咬合熱力圖', '🔥 Enable Occlusogram'),
            type: 'viewer-control',
            control: { occlusogramEnabled: true },
          },
          {
            label: tr(locale, '🦷 切換石膏材質', '🦷 Switch to Plaster Shader'),
            type: 'viewer-control',
            control: { shadingMode: 'plaster' },
          },
          {
            label: tr(locale, '➕ 一鍵新增到 local ai-proxy', '➕ One-Click Add to local ai-proxy'),
            type: 'add-mcp',
            url: MCP_PAGE_CANONICAL_URL,
          },
        ],
      };
    },
    [
      activeCase,
      archMetrics,
      cameraPreset,
      locale,
      occlusogramStats,
      onApplyViewerControl,
      viewportSettings.articulator.condylarGuidanceAngleDeg,
      viewportSettings.shadingMode,
    ]
  );

  const handleSend = useCallback(
    async (promptText?: string) => {
      const text = (promptText ?? input).trim();
      if (!text || sending) return;
      if (!promptText) setInput('');

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      // In non-browser / unit test mock environments or when relay is unreachable, generate immediate local reply
      const isRelayEndpointReachable =
        typeof window !== 'undefined' &&
        typeof fetch === 'function' &&
        !endpoint.includes('127.0.0.1:8788');

      if (!relayOnline && !isRelayEndpointReachable) {
        const localReply = generateLocalReply(text);
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            ...localReply,
          },
        ]);
        setSending(false);
        return;
      }

      try {
        const cleanEndpoint = endpoint.replace(/\/+$/, '');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);

        const systemPrompt = [
          'You are the DentalCAD Pages AI Assistant integrated with ai-proxy and MCP Pages.',
          `Active Case Order ID: ${activeCase.metadata.orderId}`,
          `Scanner Vendor: ${activeCase.metadata.scannerVendor || 'Universal IOS'}`,
          `Arch Width: U3-U3: ${archMetrics.upperIntercanineWidthMm}mm, U6-U6: ${archMetrics.upperIntermolarWidthMm}mm, Overjet: ${archMetrics.overjetMm}mm, Overbite: ${archMetrics.overbiteMm}mm`,
          `Occlusogram Min Clearance: ${occlusogramStats.minClearanceMm}mm, Contact Area: ${occlusogramStats.contactAreaMm2}mm2`,
          `MCP Page URL: ${MCP_PAGE_CANONICAL_URL}`,
        ].join('\n');

        const res = await fetch(`${cleanEndpoint}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'auto',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text },
            ],
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const replyText =
            data?.choices?.[0]?.message?.content ||
            data?.reply ||
            generateLocalReply(text).content;
          setRelayOnline(true);
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: 'assistant',
              content: String(replyText),
              actions: [
                {
                  label: tr(locale, '➕ 一鍵新增到 local ai-proxy', '➕ One-Click Add to local ai-proxy'),
                  type: 'add-mcp',
                  url: MCP_PAGE_CANONICAL_URL,
                },
              ],
            },
          ]);
          setSending(false);
          return;
        }
      } catch {
        setRelayOnline(false);
      }

      // Fallback to local smart DentalCAD & WebMCP assistant
      const localReply = generateLocalReply(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          ...localReply,
        },
      ]);
      setSending(false);
    },
    [
      input,
      sending,
      endpoint,
      activeCase,
      archMetrics,
      occlusogramStats,
      generateLocalReply,
      locale,
    ]
  );

  const handleActionClick = (
    action: NonNullable<ChatMessage['actions']>[number]
  ) => {
    if (action.type === 'add-mcp') {
      const targetUrl = action.url || MCP_PAGE_CANONICAL_URL;
      const dashUrl = `https://yongjhih.github.io/ai-proxy/dashboard#add-url=${encodeURIComponent(
        targetUrl
      )}`;
      window.open(dashUrl, '_blank', 'noopener,noreferrer');
    } else if (action.type === 'open-mcp') {
      window.open(action.url || 'mcp.html', '_blank', 'noopener,noreferrer');
    } else if (action.type === 'open-covpages') {
      window.open(action.url || 'covpages/', '_blank', 'noopener,noreferrer');
    } else if (action.type === 'viewer-control' && action.control) {
      onApplyViewerControl(action.control);
    }
  };

  if (!open) return null;

  return (
    <aside
      data-testid="ask-ai-drawer"
      aria-label="Ask AI Assistant"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-[#0b111e] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#090d16]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            data-testid="ask-ai-status-dot"
            title={
              relayOnline
                ? tr(locale, '已連接 local ai-proxy (/v1)', 'Connected to local ai-proxy (/v1)')
                : tr(
                    locale,
                    '內建智慧助手模式 (可啟動 npx ai-proxy serve 連接本機 LLM)',
                    'Built-in Smart Assistant (run npx ai-proxy serve for local LLM)'
                  )
            }
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              relayOnline
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                : 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]'
            }`}
          />
          <Sparkles className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {tr(locale, 'Ask AI · 牙科 CAD 與 MCP 助手', 'Ask AI · DentalCAD & MCP Assistant')}
          </h2>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            data-testid="ask-ai-settings-toggle"
            onClick={() => setShowSettings((v) => !v)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title={tr(locale, '設定 ai-proxy 端點', 'Configure ai-proxy Endpoint')}
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-testid="ask-ai-clear-btn"
            onClick={() => setMessages([buildWelcomeMessage(locale)])}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title={tr(locale, '清除對話', 'Clear Chat')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-testid="ask-ai-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title={tr(locale, '關閉', 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible ai-proxy Settings Panel */}
      {showSettings && (
        <div
          data-testid="ask-ai-settings-panel"
          className="px-4 py-3 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-xs space-y-2"
        >
          <label className="block font-semibold text-slate-700 dark:text-slate-300">
            {tr(locale, '本機 ai-proxy 伺服器位址：', 'Local ai-proxy Relay URL:')}
            <input
              type="url"
              value={draftEndpoint}
              onChange={(e) => setDraftEndpoint(e.target.value)}
              placeholder={DEFAULT_AI_PROXY_ENDPOINT}
              className="mt-1 w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs"
            />
          </label>
          <div className="flex items-center justify-between gap-2 pt-1">
            <a
              href={`https://yongjhih.github.io/ai-proxy/dashboard#add-url=${encodeURIComponent(
                MCP_PAGE_CANONICAL_URL
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              <Plug className="w-3.5 h-3.5" />
              <span>{tr(locale, 'ai-proxy Dashboard', 'ai-proxy Dashboard')}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDraftEndpoint(DEFAULT_AI_PROXY_ENDPOINT);
                  setEndpoint(DEFAULT_AI_PROXY_ENDPOINT);
                  try {
                    localStorage.setItem(ENDPOINT_STORAGE_KEY, DEFAULT_AI_PROXY_ENDPOINT);
                  } catch {
                    // ignore
                  }
                }}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                {tr(locale, '重設', 'Reset')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = draftEndpoint.trim() || DEFAULT_AI_PROXY_ENDPOINT;
                  setEndpoint(next);
                  setShowSettings(false);
                  try {
                    localStorage.setItem(ENDPOINT_STORAGE_KEY, next);
                  } catch {
                    // ignore
                  }
                }}
                className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
              >
                {tr(locale, '儲存', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Prompt Chips */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto flex-shrink-0">
        <button
          type="button"
          data-testid="ask-ai-chip-arch"
          onClick={() =>
            handleSend(
              tr(
                locale,
                '分析目前病例的齒弓寬度與咬合數據',
                'Analyze arch metrics and occlusion for active case'
              )
            )
          }
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-[11px] font-medium whitespace-nowrap transition-colors"
        >
          <Activity className="w-3 h-3" />
          <span>{tr(locale, '齒弓與咬合摘要', 'Arch & Occlusion')}</span>
        </button>

        <button
          type="button"
          data-testid="ask-ai-chip-mcp"
          onClick={() =>
            handleSend(
              tr(
                locale,
                '如何將此網站連接到 ai-proxy 與 MCP Pages？',
                'How do I connect this site to ai-proxy and MCP Pages?'
              )
            )
          }
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium whitespace-nowrap transition-colors"
        >
          <Terminal className="w-3 h-3" />
          <span>{tr(locale, '連接 MCP / ai-proxy', 'MCP / ai-proxy')}</span>
        </button>

        <button
          type="button"
          data-testid="ask-ai-chip-heatmap"
          onClick={() =>
            handleSend(tr(locale, '開啟咬合接觸熱力圖', 'Show Occlusogram heatmap'))
          }
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-medium whitespace-nowrap transition-colors"
        >
          <Eye className="w-3 h-3" />
          <span>{tr(locale, '開啟熱力圖', 'Heatmap')}</span>
        </button>

        <button
          type="button"
          data-testid="ask-ai-chip-covpages"
          onClick={() =>
            handleSend(tr(locale, '查看 covpages 測試覆蓋率報告', 'View covpages test coverage report'))
          }
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-[11px] font-medium whitespace-nowrap transition-colors"
        >
          <BarChart2 className="w-3 h-3" />
          <span>covpages</span>
        </button>
      </div>

      {/* Messages List */}
      <div
        data-testid="ask-ai-messages"
        className="flex-1 overflow-y-auto p-4 space-y-3 text-xs leading-relaxed"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-3 border ${
              msg.role === 'user'
                ? 'ml-8 bg-sky-600 text-white border-sky-500'
                : 'mr-4 bg-slate-100 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
            {msg.actions && msg.actions.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-1.5">
                {msg.actions.map((act, idx) => (
                  <button
                    key={`${msg.id}-act-${idx}`}
                    type="button"
                    onClick={() => handleActionClick(act)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      act.type === 'add-mcp'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <span>{act.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Footer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090d16] flex items-center gap-2"
      >
        <input
          type="text"
          data-testid="ask-ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tr(
            locale,
            '詢問齒弓數據、MCP 工具或輸入指令控制 3D...',
            'Ask about arch metrics, MCP tools, or 3D commands...'
          )}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button
          type="submit"
          data-testid="ask-ai-send-btn"
          disabled={sending || !input.trim()}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{tr(locale, '發送', 'Send')}</span>
        </button>
      </form>
    </aside>
  );
};
