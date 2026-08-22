import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GrammarSection from './components/GrammarSection';
import VocabSection from './components/VocabSection';
import KanjiSection from './components/KanjiSection';
import ApiKeyModal from './components/ApiKeyModal';

// JSON Datasets
import grammarN3 from './data/grammarN3.json';
import grammarN4 from './data/grammarN4.json';
import vocabData from './data/vocabData.json';
import kanjiData from './data/kanjiData.json';

const grammarDataByLevel = {
  N3: grammarN3,
  N4: grammarN4,
};

export default function App() {
  // Navigation & Level State
  const [activeLevel, setActiveLevel] = useState('N3'); // 'N3' | 'N4'
  const [activeSection, setActiveSection] = useState('grammar'); // 'grammar' | 'vocab' | 'kanji'
  const [activeLesson, setActiveLesson] = useState(1);
  const [showTranslations, setShowTranslations] = useState(true);

  // Synchronize active lesson when level changes
  useEffect(() => {
    if (activeLevel === 'N4') {
      setActiveLesson(26);
    } else {
      setActiveLesson(1);
    }
  }, [activeLevel]);

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

  const currentGrammarData = grammarDataByLevel[activeLevel] || {};

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
            grammarData={currentGrammarData}
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
            vocabData={vocabData}
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
            kanjiData={kanjiData}
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