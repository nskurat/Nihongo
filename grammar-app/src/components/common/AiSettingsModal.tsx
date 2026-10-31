import { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  ExternalLink,
  X,
  ShieldCheck,
  Check,
  Cpu,
  Bot,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  WifiOff,
  BadgeCheck,
} from 'lucide-react';
import {
  getRegisteredProviders,
  getActiveProviderId,
  setActiveProviderId,
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
} from '../../services/ai/registry';
import { getKeyChecker } from '../../services/ai/keyChecker';
import { KeyCheckResult } from '../../services/ai/modelListing';
import { buildPickerOptions, getDefaultModelId } from '../../services/ai/modelCatalog';
import { AiProvider, AiProviderId } from '../../types/ai';

/** Result of the free "Check key" call, tagged with the provider tab it was made for. */
interface KeyCheckState {
  loading: boolean;
  provider: AiProviderId | null;
  result: KeyCheckResult | null;
}

const IDLE_CHECK: KeyCheckState = { loading: false, provider: null, result: null };

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialError?: string;
}

export default function AiSettingsModal({ isOpen, onClose, initialError = '' }: AiSettingsModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // getRegisteredProviders() returns Object.values() of a static registry - a new
  // array reference every call even though the providers themselves never change.
  const providers = useMemo(() => getRegisteredProviders(), []);
  const [activeProvider, setActiveProvider] = useState<AiProviderId>(getActiveProviderId());
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [keyCheck, setKeyCheck] = useState<KeyCheckState>(IDLE_CHECK);
  const [openError, setOpenError] = useState('');

  // Load stored settings on open. This re-syncs the form from localStorage (an
  // external system) each time the modal opens, rather than adjusting state from a
  // prop change - a legitimate effect, but the lint rule can't tell the two apart.
  useEffect(() => {
    if (isOpen) {
      const currentActive = getActiveProviderId();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setActiveProvider(currentActive);

      const keys: Record<string, string> = {};
      const models: Record<string, string> = {};
      providers.forEach((p: AiProvider) => {
        keys[p.id] = getStoredApiKey(p.id);
        models[p.id] = getStoredModel(p.id);
      });
      setApiKeys(keys);
      setSelectedModels(models);
      setSavedSuccess(false);
      setKeyCheck(IDLE_CHECK);
      setOpenError(initialError);
    }
  }, [isOpen, initialError, providers]);

  if (!isOpen) return null;

  const currentProviderConfig = providers.find((p) => p.id === activeProvider) || providers[0];
  const currentKey = apiKeys[activeProvider] || '';
  const currentModel = selectedModels[activeProvider] || getDefaultModelId(currentProviderConfig.models);
  const picker = buildPickerOptions(currentProviderConfig.models, currentModel);
  // A check result only belongs to the tab it was made for.
  const checkResult = keyCheck.provider === activeProvider ? keyCheck.result : null;
  const checkLoading = keyCheck.loading && keyCheck.provider === activeProvider;

  // Nothing below writes to storage: only Save does.
  const handleKeyChange = (val: string) => {
    setApiKeys((prev) => ({ ...prev, [activeProvider]: val }));
    setSavedSuccess(false);
    setKeyCheck(IDLE_CHECK);
    setOpenError('');
  };

  const handleModelChange = (val: string) => {
    setSelectedModels((prev) => ({ ...prev, [activeProvider]: val }));
    setSavedSuccess(false);
  };

  const handleSave = () => {
    setActiveProviderId(activeProvider);
    setStoredApiKey(activeProvider, currentKey);
    setStoredModel(activeProvider, currentModel);

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  // Free check: lists the OPEN tab's models with the key as typed. No tokens, no storage writes.
  const handleCheckKey = async () => {
    const provider = activeProvider;
    setOpenError('');
    setKeyCheck({ loading: true, provider, result: null });
    const result = await getKeyChecker().check(provider, currentKey);
    // Drop the result if the key was edited (which resets the check) while it was in flight.
    setKeyCheck((prev) => (prev.provider === provider && prev.loading ? { loading: false, provider, result } : prev));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-400">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                AI Provider Settings
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Bring Your Own Key (BYOK) • Multi-Provider Architecture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Provider Selection Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
              Select Active AI Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {providers.map((p: AiProvider) => {
                const isSelected = activeProvider === p.id;
                const hasKey = !!apiKeys[p.id] || !p.requiresKey;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProvider(p.id);
                      setSavedSuccess(false);
                      setOpenError('');
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all relative cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 shadow-xs ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs text-slate-900">{p.name}</span>
                      {hasKey && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Key configured" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{p.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Provider Details & Configuration */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm">{currentProviderConfig.name}</h4>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {currentProviderConfig.description}
                </p>
              </div>

              {currentProviderConfig.website && (
                <a
                  href={currentProviderConfig.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs shrink-0 cursor-pointer"
                >
                  <span>Get API Key</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Model Selector */}
            {currentProviderConfig.models.length > 0 && (
              <div>
                <label
                  htmlFor="ai-model-select"
                  className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5"
                >
                  <Cpu size={13} className="text-indigo-500" /> Model Selection
                </label>
                <select
                  id="ai-model-select"
                  value={currentModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className={`w-full text-xs font-medium bg-white border rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                    picker.selectedMissing ? 'border-amber-400' : 'border-slate-300'
                  }`}
                >
                  {picker.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {picker.selectedMissing && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700">
                    <AlertTriangle size={13} className="shrink-0 mt-px" />
                    <span>
                      Your saved model <code className="bg-amber-50 px-1 rounded">{currentModel}</code> is not in the
                      current list. It may have been retired. Pick another model and save.
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* API Key Input */}
            {currentProviderConfig.requiresKey ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <KeyRound size={13} className="text-indigo-500" /> {currentProviderConfig.name} API Key
                </label>
                <input
                  type="password"
                  value={currentKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 font-medium">
                ✓ No API key required. Connects directly.
              </div>
            )}

            {/* Free key check: lists models, spends no tokens */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCheckKey}
                disabled={checkLoading || (currentProviderConfig.requiresKey && !currentKey.trim())}
                title="Lists the models this key can use. Free: no tokens are spent."
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {checkLoading ? (
                  <Loader2 size={13} className="animate-spin text-indigo-600" />
                ) : (
                  <BadgeCheck size={13} className="text-indigo-600" />
                )}
                {checkLoading ? 'Checking...' : 'Check key'}
              </button>

              {!checkResult && !checkLoading && !openError && (
                <span className="text-[11px] text-slate-400">Free check: spends no tokens, saves nothing.</span>
              )}

              {checkResult?.status === 'ok' && (
                <div className="flex flex-col items-end gap-0.5 text-xs animate-fade-in" role="status">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <CheckCircle2 size={14} /> Key works
                    {checkResult.modelIds.length > 0 && (
                      <span className="font-normal text-emerald-600">
                        ({checkResult.modelIds.length} models available)
                      </span>
                    )}
                  </span>
                  {checkResult.modelIds.length > 0 && !checkResult.modelIds.includes(currentModel) && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-700">
                      <AlertTriangle size={12} /> The selected model is not offered to this key.
                    </span>
                  )}
                </div>
              )}

              {checkResult?.status === 'invalid-key' && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium animate-fade-in" role="alert">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="line-clamp-2">Invalid key: {checkResult.message}</span>
                </div>
              )}

              {checkResult?.status === 'network' && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium animate-fade-in" role="alert">
                  <WifiOff size={14} className="shrink-0" />
                  <span className="line-clamp-2">Network or CORS blocked: could not reach the provider.</span>
                </div>
              )}

              {checkResult?.status === 'error' && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium animate-fade-in" role="alert">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="line-clamp-2">{checkResult.message}</span>
                </div>
              )}

              {!checkResult && openError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium animate-fade-in">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="line-clamp-1">{openError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Privacy Note */}
          <div className="flex items-start gap-2.5 p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-950">
            <ShieldCheck size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Your API keys are stored <strong>strictly locally</strong> in your browser's <code className="bg-white/80 px-1 py-0.5 rounded text-[11px]">localStorage</code>. They are sent directly from your browser to the selected provider and never touch any intermediate server.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={() => handleKeyChange('')}
            title="Empties the key field. Press Save to remove the stored key."
            className="text-xs text-slate-500 hover:text-rose-600 font-medium px-2 py-1 transition-colors cursor-pointer"
          >
            Clear Active Key
          </button>

          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? <Check size={14} /> : null}
              {savedSuccess ? 'Saved!' : 'Save & Activate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
