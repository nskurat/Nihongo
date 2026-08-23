import { useState, useEffect } from 'react';
import Header from './components/Header';
import GrammarSection from './components/GrammarSection';
import VocabSection from './components/VocabSection';
import KanjiSection from './components/KanjiSection';
import ReadingSection from './components/ReadingSection';
import AiSettingsModal from './components/AiSettingsModal';
import {
  generateGrammarExamples,
  generateGrammarNuance,
  generateVocabHelp,
  generateKanjiMnemonic,
  GrammarExampleSentence,
} from './services/ai/registry';
import { LevelType, SectionType, GrammarItem, VocabItem, KanjiItem, StudyDataSet } from './types/japanese';

import grammarN3 from './data/n3/grammar.json';
import vocabN3 from './data/n3/vocab.json';
import kanjiN3 from './data/n3/kanji.json';

import grammarN4 from './data/n4/grammar.json';
import vocabN4 from './data/n4/vocab.json';
import kanjiN4 from './data/n4/kanji.json';

const studyData: Record<LevelType, StudyDataSet> = {
  N3: {
    grammar: grammarN3 as unknown as Record<number, GrammarItem[]>,
    vocab: vocabN3 as unknown as Record<number, VocabItem[]>,
    kanji: kanjiN3 as unknown as Record<number, KanjiItem[]>,
  },
  N4: {
    grammar: grammarN4 as unknown as Record<number, GrammarItem[]>,
    vocab: vocabN4 as unknown as Record<number, VocabItem[]>,
    kanji: kanjiN4 as unknown as Record<number, KanjiItem[]>,
  },
};

// Helper to parse URL path/params/hash on load
const getInitialState = (): { level: LevelType; section: SectionType; lesson: number } => {
  try {
    const pathname = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace('#', '').toLowerCase();

    let level: LevelType = (params.get('level')?.toUpperCase() as LevelType) || 'N3';
    if (level !== 'N3' && level !== 'N4') level = 'N3';

    let section: SectionType = 'grammar';
    if (pathname.includes('/vocab') || params.get('section') === 'vocab' || hash === 'vocab') {
      section = 'vocab';
    } else if (pathname.includes('/kanji') || params.get('section') === 'kanji' || hash === 'kanji') {
      section = 'kanji';
    } else if (pathname.includes('/reading') || params.get('section') === 'reading' || hash === 'reading') {
      section = 'reading';
    } else if (pathname.includes('/grammar') || params.get('section') === 'grammar' || hash === 'grammar') {
      section = 'grammar';
    }

    let lesson = parseInt(params.get('lesson') || '', 10);
    if (isNaN(lesson)) lesson = level === 'N4' ? 26 : 1;

    return { level, section, lesson };
  } catch {
    return { level: 'N3', section: 'grammar', lesson: 1 };
  }
};

export default function App() {
  const initial = getInitialState();

  // Navigation & Level State
  const [activeLevel, setActiveLevel] = useState<LevelType>(initial.level);
  const [activeSection, setActiveSection] = useState<SectionType>(initial.section);
  const [activeLesson, setActiveLesson] = useState<number>(initial.lesson);
  const [showTranslations, setShowTranslations] = useState<boolean>(true);

  // Synchronize active lesson when level changes
  useEffect(() => {
    if (activeLevel === 'N4' && activeLesson < 26) {
      setActiveLesson(26);
    } else if (activeLevel === 'N3' && activeLesson > 24) {
      setActiveLesson(1);
    }
  }, [activeLevel, activeLesson]);

  // Sync state to URL params for clean bookmarking & sharing
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('level', activeLevel);
      url.searchParams.set('section', activeSection);
      url.searchParams.set('lesson', String(activeLesson));
      window.history.replaceState(null, '', url.toString());
    } catch {
      // Ignore if in restricted environment
    }
  }, [activeLevel, activeSection, activeLesson]);

  // AI & Generation States
  const [generatedExamples, setGeneratedExamples] = useState<Record<string | number, GrammarExampleSentence[]>>({});
  const [loadingExamples, setLoadingExamples] = useState<Record<string | number, boolean>>({});
  const [aiExplanations, setAiExplanations] = useState<Record<string | number, string>>({});
  const [loadingExplanations, setLoadingExplanations] = useState<Record<string | number, boolean>>({});
  const [loadingVocabAi, setLoadingVocabAi] = useState<Record<string | number, boolean>>({});
  const [aiVocabNotes, setAiVocabNotes] = useState<Record<string | number, string>>({});
  const [loadingKanjiAi, setLoadingKanjiAi] = useState<Record<string | number, boolean>>({});
  const [aiKanjiMnemonics, setAiKanjiMnemonics] = useState<Record<string | number, string>>({});

  // AI Settings Modal & Error State
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');

  // AI Handler: Grammar Examples
  const handleGenerateExamples = async (grammar: GrammarItem) => {
    setLoadingExamples((prev) => ({ ...prev, [grammar.id]: true }));
    try {
      const newExamples = await generateGrammarExamples({ grammar, level: activeLevel });
      if (newExamples && newExamples.length > 0) {
        setGeneratedExamples((prev) => ({
          ...prev,
          [grammar.id]: [...(prev[grammar.id] || []), ...newExamples],
        }));
        setApiError('');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === 'MISSING_KEY') {
        setShowKeyModal(true);
      } else {
        setApiError(msg);
        console.error('Failed to generate examples:', error);
      }
    } finally {
      setLoadingExamples((prev) => ({ ...prev, [grammar.id]: false }));
    }
  };

  // AI Handler: Grammar Nuance
  const handleExplainNuance = async (grammar: GrammarItem) => {
    setLoadingExplanations((prev) => ({ ...prev, [grammar.id]: true }));
    try {
      const text = await generateGrammarNuance({ grammar, level: activeLevel });
      if (text) {
        setAiExplanations((prev) => ({
          ...prev,
          [grammar.id]: text,
        }));
        setApiError('');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === 'MISSING_KEY') {
        setShowKeyModal(true);
      } else {
        setApiError(msg);
        console.error('Failed to fetch explanation:', error);
      }
    } finally {
      setLoadingExplanations((prev) => ({ ...prev, [grammar.id]: false }));
    }
  };

  // AI Handler: Vocabulary Usage Note
  const handleGenerateVocabHelp = async (vocab: VocabItem) => {
    setLoadingVocabAi((prev) => ({ ...prev, [vocab.id]: true }));
    try {
      const text = await generateVocabHelp({ vocab, level: activeLevel });
      if (text) {
        setAiVocabNotes((prev) => ({
          ...prev,
          [vocab.id]: text,
        }));
        setApiError('');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === 'MISSING_KEY') {
        setShowKeyModal(true);
      } else {
        setApiError(msg);
        console.error('Failed to generate vocab help:', error);
      }
    } finally {
      setLoadingVocabAi((prev) => ({ ...prev, [vocab.id]: false }));
    }
  };

  // AI Handler: Kanji Mnemonic
  const handleGenerateKanjiMnemonic = async (kanjiItem: KanjiItem) => {
    setLoadingKanjiAi((prev) => ({ ...prev, [kanjiItem.id]: true }));
    try {
      const text = await generateKanjiMnemonic({ kanji: kanjiItem, level: activeLevel });
      if (text) {
        setAiKanjiMnemonics((prev) => ({
          ...prev,
          [kanjiItem.id]: text,
        }));
        setApiError('');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === 'MISSING_KEY') {
        setShowKeyModal(true);
      } else {
        setApiError(msg);
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

        {activeSection === 'reading' && (
          <ReadingSection
            activeLevel={activeLevel}
            grammarData={currentData.grammar || {}}
            vocabData={currentData.vocab || {}}
            onOpenKeyModal={() => setShowKeyModal(true)}
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

      {/* AI Provider Settings Modal */}
      <AiSettingsModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        initialError={apiError}
      />
    </div>
  );
}
