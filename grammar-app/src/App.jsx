import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GrammarSection from './components/GrammarSection';
import VocabSection from './components/VocabSection';
import KanjiSection from './components/KanjiSection';
import ApiKeyModal from './components/ApiKeyModal';

// JSON Datasets by Level
import grammarN3 from './data/n3/grammar.json';
import vocabN3 from './data/n3/vocab.json';
import kanjiN3 from './data/n3/kanji.json';

import grammarN4 from './data/n4/grammar.json';
import vocabN4 from './data/n4/vocab.json';
import kanjiN4 from './data/n4/kanji.json';

const studyData = {
  N3: {
    grammar: grammarN3,
    vocab: vocabN3,
    kanji: kanjiN3,
  },
  N4: {
    grammar: grammarN4,
    vocab: vocabN4,
    kanji: kanjiN4,
  },
};

// Helper to parse URL path/params/hash on load
const getInitialState = () => {
  try {
    const pathname = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace('#', '').toLowerCase();

    let level = params.get('level')?.toUpperCase();
    if (level !== 'N3' && level !== 'N4') level = 'N3';

    let section = 'grammar';
    if (pathname.includes('/vocab') || params.get('section') === 'vocab' || hash === 'vocab') {
      section = 'vocab';
    } else if (pathname.includes('/kanji') || params.get('section') === 'kanji' || hash === 'kanji') {
      section = 'kanji';
    } else if (pathname.includes('/grammar') || params.get('section') === 'grammar' || hash === 'grammar') {
      section = 'grammar';
    }

    let lesson = parseInt(params.get('lesson'), 10);
    if (isNaN(lesson)) lesson = level === 'N4' ? 26 : 1;

    return { level, section, lesson };
  } catch {
    return { level: 'N3', section: 'grammar', lesson: 1 };
  }
};

export default function App() {
  const initial = getInitialState();

  // Navigation & Level State
  const [activeLevel, setActiveLevel] = useState(initial.level); // 'N3' | 'N4'
  const [activeSection, setActiveSection] = useState(initial.section); // 'grammar' | 'vocab' | 'kanji'
  const [activeLesson, setActiveLesson] = useState(initial.lesson);
  const [showTranslations, setShowTranslations] = useState(true);

  // Synchronize active lesson when level changes
  useEffect(() => {
    if (activeLevel === 'N4' && activeLesson < 26) {
      setActiveLesson(26);
    } else if (activeLevel === 'N3' && activeLesson > 24) {
      setActiveLesson(1);
    }
  }, [activeLevel]);

  // Sync state to URL params for clean bookmarking & sharing
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('level', activeLevel);
      url.searchParams.set('section', activeSection);
      url.searchParams.set('lesson', activeLesson);
      window.history.replaceState(null, '', url.toString());
    } catch (e) {
      // Ignore if in restricted environment
    }
  }, [activeLevel, activeSection, activeLesson]);

  // AI & Generation States
  const [generatedExamples, setGeneratedExamples] = useState({});
  const [loadingExamples, setLoadingExamples] = useState({});
  const [aiExplanations, setAiExplanations] = useState({});
  const [loadingExplanations, setLoadingExplanations] = useState({});
  const [loadingVocabAi, setLoadingVocabAi] = useState({});
  const [aiVocabNotes, setAiVocabNotes] = useState({});
  const [loadingKanjiAi, setLoadingKanjiAi] = useState({});
  const [aiKanjiMnemonics, setAiKanjiMnemonics] = useState({});

  // Gemini API Key State & Storage
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiError, setApiError] = useState('');

  const saveApiKey = (key) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('gemini_api_key', trimmed);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    setShowKeyModal(false);
    setApiError('');
  };

  const getEffectiveApiKey = () => {
    return apiKey || localStorage.getItem('gemini_api_key') || (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';
  };

  const callGeminiApi = async (payload) => {
    const key = getEffectiveApiKey();
    if (!key) {
      setShowKeyModal(true);
      throw new Error('MISSING_KEY');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (response.ok && result.candidates && result.candidates.length > 0) {
      setApiError('');
      return result;
    }

    if (result.error) {
      const msg = result.error.message || `API Error: ${response.status}`;
      setApiError(msg);
      if (result.error.status === 'INVALID_ARGUMENT' || msg.toLowerCase().includes('api key')) {
        setShowKeyModal(true);
      }
      throw new Error(msg);
    }
    throw new Error('Failed to fetch from Gemini API.');
  };

  // AI Handler: Grammar Examples
  const handleGenerateExamples = async (grammar) => {
    setLoadingExamples((prev) => ({ ...prev, [grammar.id]: true }));
    try {
      const payload = {
        contents: [
          {
            parts: [
              {
                text: `Generate 2 new, natural Japanese example sentences for the JLPT ${activeLevel} grammar point: "${grammar.title}" (Meaning: ${grammar.meaning}). Structure: ${grammar.structure}. Return them as a JSON array with 'jp' and 'en' keys.`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                jp: { type: 'STRING' },
                en: { type: 'STRING' },
              },
              propertyOrdering: ['jp', 'en'],
            },
          },
        },
      };

      const result = await callGeminiApi(payload);
      if (result.candidates && result.candidates.length > 0) {
        const jsonText = result.candidates[0].content.parts[0].text;
        const newExamples = JSON.parse(jsonText);
        setGeneratedExamples((prev) => ({
          ...prev,
          [grammar.id]: [...(prev[grammar.id] || []), ...newExamples],
        }));
      }
    } catch (error) {
      if (error.message !== 'MISSING_KEY') {
        console.error('Failed to generate examples:', error);
      }
    } finally {
      setLoadingExamples((prev) => ({ ...prev, [grammar.id]: false }));
    }
  };

  // AI Handler: Grammar Nuance
  const handleExplainNuance = async (grammar) => {
    setLoadingExplanations((prev) => ({ ...prev, [grammar.id]: true }));
    try {
      const payload = {
        contents: [
          {
            parts: [
              {
                text: `Act as an expert Japanese linguist. Briefly explain subtle nuances, typical conversational contexts, and common learner traps for "${grammar.title}" (${grammar.meaning}) at ${activeLevel} level. Keep it to one clear, insightful paragraph.`,
              },
            ],
          },
        ],
      };

      const result = await callGeminiApi(payload);
      if (result.candidates && result.candidates.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        setAiExplanations((prev) => ({
          ...prev,
          [grammar.id]: text,
        }));
      }
    } catch (error) {
      if (error.message !== 'MISSING_KEY') {
        console.error('Failed to fetch explanation:', error);
      }
    } finally {
      setLoadingExplanations((prev) => ({ ...prev, [grammar.id]: false }));
    }
  };

  // AI Handler: Vocabulary Usage Note
  const handleGenerateVocabHelp = async (vocab) => {
    setLoadingVocabAi((prev) => ({ ...prev, [vocab.id]: true }));
    try {
      const payload = {
        contents: [
          {
            parts: [
              {
                text: `Explain practical usage, common collocations, or register nuances for the Japanese word "${vocab.word}" (${vocab.reading}, meaning: "${vocab.meaning}") for a JLPT ${activeLevel} learner. Keep it to 1-2 concise sentences with 1 extra natural sample sentence.`,
              },
            ],
          },
        ],
      };

      const result = await callGeminiApi(payload);
      if (result.candidates && result.candidates.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        setAiVocabNotes((prev) => ({
          ...prev,
          [vocab.id]: text,
        }));
      }
    } catch (error) {
      if (error.message !== 'MISSING_KEY') {
        console.error('Failed to generate vocab help:', error);
      }
    } finally {
      setLoadingVocabAi((prev) => ({ ...prev, [vocab.id]: false }));
    }
  };

  // AI Handler: Kanji Mnemonic
  const handleGenerateKanjiMnemonic = async (kanjiItem) => {
    setLoadingKanjiAi((prev) => ({ ...prev, [kanjiItem.id]: true }));
    try {
      const payload = {
        contents: [
          {
            parts: [
              {
                text: `Create a memorable, vivid mnemonic story to easily remember the Kanji "${kanjiItem.kanji}" (Meaning: "${kanjiItem.meaning}", Radical: "${kanjiItem.radical || 'components'}", On: "${(kanjiItem.onyomi || []).join(', ')}", Kun: "${(kanjiItem.kunyomi || []).join(', ')}"). Keep it under 2 punchy sentences.`,
              },
            ],
          },
        ],
      };

      const result = await callGeminiApi(payload);
      if (result.candidates && result.candidates.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        setAiKanjiMnemonics((prev) => ({
          ...prev,
          [kanjiItem.id]: text,
        }));
      }
    } catch (error) {
      if (error.message !== 'MISSING_KEY') {
        console.error('Failed to generate kanji mnemonic:', error);
      }
    } finally {
      setLoadingKanjiAi((prev) => ({ ...prev, [kanjiItem.id]: false }));
    }
  };

  const currentData = studyData[activeLevel] || {};

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between">
      <div>
        {/* Universal Header with Level Switcher & Section Tabs */}
        <Header
          activeLevel={activeLevel}
          setActiveLevel={setActiveLevel}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          showTranslations={showTranslations}
          setShowTranslations={setShowTranslations}
          apiKey={apiKey}
          onOpenKeyModal={() => setShowKeyModal(true)}
        />

        {/* Dynamic Section View */}
        {activeSection === 'grammar' && (
          <GrammarSection
            grammarData={currentData.grammar || {}}
            activeLesson={activeLesson}
            setActiveLesson={setActiveLesson}
            showTranslations={showTranslations}
            onGenerateExamples={handleGenerateExamples}
            onExplainNuance={handleExplainNuance}
            loadingExamples={loadingExamples}
            loadingExplanations={loadingExplanations}
            generatedExamples={generatedExamples}
            aiExplanations={aiExplanations}
            activeLevel={activeLevel}
          />
        )}

        {activeSection === 'vocab' && (
          <VocabSection
            vocabData={currentData.vocab || {}}
            activeLesson={activeLesson}
            setActiveLesson={setActiveLesson}
            showTranslations={showTranslations}
            activeLevel={activeLevel}
            onGenerateVocabHelp={handleGenerateVocabHelp}
            loadingVocabAi={loadingVocabAi}
            aiVocabNotes={aiVocabNotes}
          />
        )}

        {activeSection === 'kanji' && (
          <KanjiSection
            kanjiData={currentData.kanji || {}}
            activeLesson={activeLesson}
            setActiveLesson={setActiveLesson}
            activeLevel={activeLevel}
            showTranslations={showTranslations}
            onGenerateKanjiMnemonic={handleGenerateKanjiMnemonic}
            loadingKanjiAi={loadingKanjiAi}
            aiKanjiMnemonics={aiKanjiMnemonics}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-slate-200 bg-white/50 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Minna no Nihongo Study Portal • JLPT N4 & N3</span>
          <span>Interactive Grammar, Vocabulary & Kanji Reference</span>
        </div>
      </footer>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        apiKey={apiKey}
        onSave={saveApiKey}
        apiError={apiError}
      />
    </div>
  );
}