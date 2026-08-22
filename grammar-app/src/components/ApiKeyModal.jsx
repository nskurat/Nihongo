import React, { useState } from 'react';
import { Key, X } from 'lucide-react';

export default function ApiKeyModal({ isOpen, onClose, apiKey, onSave, apiError }) {
  const [tempKey, setTempKey] = useState(apiKey || '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Key className="text-indigo-600" size={20} />
            Gemini API Key
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          To enable AI-assisted example sentences, grammar nuance breakdowns, and kanji mnemonics, please provide your free Google Gemini API Key.
        </p>

        {apiError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 font-medium">
            {apiError}
          </div>
        )}

        <input
          type="password"
          placeholder="AIzaSy..."
          value={tempKey}
          onChange={(e) => setTempKey(e.target.value)}
          className="w-full p-3 border border-slate-300 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono shadow-inner"
        />

        <div className="flex justify-between items-center">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-600 hover:underline font-semibold"
          >
            Get a free key &rarr;
          </a>
          <div className="flex gap-2">
            {apiKey && (
              <button
                onClick={() => {
                  setTempKey('');
                  onSave('');
                }}
                className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => onSave(tempKey)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
