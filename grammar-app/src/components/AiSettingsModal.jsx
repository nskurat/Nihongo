import React, { useState, useEffect } from 'react';
import { KeyRound, ExternalLink, X, ShieldCheck, Sparkles, Check, ChevronRight, Cpu, Bot, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  getProviders,
  getActiveProviderId,
  setActiveProviderId,
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  executeAiPrompt,
} from '../services/ai/registry';

export default function AiSettingsModal({ isOpen, onClose, initialError = '' }) {
  const providers = getProviders();
  const [activeProvider, setActiveProvider] = useState(getActiveProviderId());
  const [apiKeys, setApiKeys] = useState({});
  const [selectedModels, setSelectedModels] = useState({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingStatus, setTestingStatus] = useState({ loading: false, success: null, error: '' });

  // Load stored settings on open
  useEffect(() => {
    if (isOpen) {
      const currentActive = getActiveProviderId();
      setActiveProvider(currentActive);

      const keys = {};
      const models = {};
      providers.forEach((p) => {
        keys[p.id] = getStoredApiKey(p.id);
        models[p.id] = getStoredModel(p.id);
      });
      setApiKeys(keys);
      setSelectedModels(models);
      setSavedSuccess(false);
      setTestingStatus({ loading: false, success: null, error: initialError });
    }
  }, [isOpen, initialError]);

  if (!isOpen) return null;

  const currentProviderConfig = providers.find((p) => p.id === activeProvider) || providers[0];
  const currentKey = apiKeys[activeProvider] || '';
  const currentModel = selectedModels[activeProvider] || currentProviderConfig.defaultModel;

  const handleKeyChange = (val) => {
    setApiKeys((prev) => ({ ...prev, [activeProvider]: val }));
    setSavedSuccess(false);
    setTestingStatus({ loading: false, success: null, error: '' });
  };

  const handleModelChange = (val) => {
    setSelectedModels((prev) => ({ ...prev, [activeProvider]: val }));
    setStoredModel(activeProvider, val);
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

  const handleTestConnection = async () => {
    setTestingStatus({ loading: true, success: null, error: '' });
    try {
      // Save temporarily to test
      setStoredApiKey(activeProvider, currentKey);
      setStoredModel(activeProvider, currentModel);

      const res = await executeAiPrompt('Respond with the word "OK".', {
        providerId: activeProvider,
        apiKey: currentKey,
        model: currentModel,
      });

      if (res) {
        setTestingStatus({ loading: false, success: true, error: '' });
      }
    } catch (err) {
      setTestingStatus({
        loading: false,
        success: false,
        error: err.message === 'MISSING_KEY' ? 'Please enter an API key first.' : err.message,
      });
    }
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
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
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
              {providers.map((p) => {
                const isSelected = activeProvider === p.id;
                const hasKey = !!apiKeys[p.id] || !p.requiresKey;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProvider(p.id);
                      setTestingStatus({ loading: false, success: null, error: '' });
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all relative ${
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
                    <span className="text-[10px] text-slate-500 line-clamp-1">{p.badge}</span>
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
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-semibold rounded-md">
                    {currentProviderConfig.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {currentProviderConfig.description}
                </p>
              </div>

              {currentProviderConfig.helpUrl && (
                <a
                  href={currentProviderConfig.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs shrink-0"
                >
                  <span>Get API Key</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Model Selector */}
            {currentProviderConfig.models.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Cpu size={13} className="text-indigo-500" /> Model Selection
                </label>
                <select
                  value={currentModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {currentProviderConfig.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
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
                  placeholder={currentProviderConfig.keyPlaceholder}
                  className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 font-medium">
                ✓ No API key required. Connects directly to your local endpoint ({currentProviderConfig.models[0]?.name}).
              </div>
            )}

            {/* Test Connection Button & Status */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingStatus.loading || (currentProviderConfig.requiresKey && !currentKey)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors disabled:opacity-40"
              >
                {testingStatus.loading ? (
                  <Loader2 size={13} className="animate-spin text-indigo-600" />
                ) : (
                  <Sparkles size={13} className="text-indigo-600" />
                )}
                {testingStatus.loading ? 'Testing...' : 'Test Connection'}
              </button>

              {testingStatus.success && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold animate-fade-in">
                  <CheckCircle2 size={14} /> Connection Successful!
                </div>
              )}

              {testingStatus.error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium animate-fade-in">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="line-clamp-1">{testingStatus.error}</span>
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
            onClick={() => {
              handleKeyChange('');
              setStoredApiKey(activeProvider, '');
            }}
            className="text-xs text-slate-500 hover:text-rose-600 font-medium px-2 py-1 transition-colors"
          >
            Clear Active Key
          </button>

          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg border border-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5"
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
