import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import Header from './components/common/Header';
import GrammarSection from './features/grammar/GrammarSection';
import VocabSection from './features/vocab/VocabSection';
import KanjiSection from './features/kanji/KanjiSection';
import ReadingSection from './features/reading/ReadingSection';
import AiSettingsModal from './components/common/AiSettingsModal';
import { useAiUiStore } from './store/useAiStore';
import { LevelType, SectionType } from './types/japanese';

// Wrap the route contents to extract URL params and sync with UI
function ContentWrapper() {
  const { level, section, lesson } = useParams<{ level: string; section: string; lesson?: string }>();
  
  const parsedLevel = (level?.toUpperCase() === 'N4' ? 'N4' : 'N3') as LevelType;
  const parsedSection = (section?.toLowerCase() || 'grammar') as SectionType;
  
  // Default to lesson 1 for N3, lesson 26 for N4 if not specified
  let parsedLesson = parseInt(lesson || '', 10);
  if (isNaN(parsedLesson)) {
    parsedLesson = parsedLevel === 'N4' ? 26 : 1;
  }

  // Ensure valid lesson ranges
  if (parsedLevel === 'N4' && parsedLesson < 26) parsedLesson = 26;
  if (parsedLevel === 'N3' && parsedLesson > 24) parsedLesson = 1;

  // We use this component to render the appropriate section based on the URL
  return (
    <>
      {parsedSection === 'grammar' && (
        <GrammarSection activeLevel={parsedLevel} activeLesson={parsedLesson} />
      )}
      {parsedSection === 'vocab' && (
        <VocabSection activeLevel={parsedLevel} activeLesson={parsedLesson} />
      )}
      {parsedSection === 'kanji' && (
        <KanjiSection activeLevel={parsedLevel} activeLesson={parsedLesson} />
      )}
      {parsedSection === 'reading' && (
        <ReadingSection activeLevel={parsedLevel} />
      )}
    </>
  );
}

export default function App() {
  const { showKeyModal, setShowKeyModal, apiError } = useAiUiStore();
  
  // Sync legacy URLs to new router format
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    // If we land on root or old hash-based URLs, redirect them cleanly
    if (location.pathname === '/') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace('#', '').toLowerCase();
      
      let level = params.get('level')?.toLowerCase() || 'n3';
      if (level !== 'n3' && level !== 'n4') level = 'n3';
      
      let section = params.get('section') || hash || 'grammar';
      if (!['grammar', 'vocab', 'kanji', 'reading'].includes(section)) section = 'grammar';
      
      let lesson = parseInt(params.get('lesson') || '', 10);
      if (isNaN(lesson)) lesson = level === 'n4' ? 26 : 1;

      navigate(`/${level}/${section}/${lesson}`, { replace: true });
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between">
      <div>
        <Header />

        <Routes>
          <Route path="/:level/:section/:lesson" element={<ContentWrapper />} />
          <Route path="/:level/:section" element={<ContentWrapper />} />
          <Route path="/" element={<Navigate to="/n3/grammar/1" replace />} />
          <Route path="*" element={<Navigate to="/n3/grammar/1" replace />} />
        </Routes>
      </div>

      <footer className="mt-12 py-6 border-t border-slate-200 bg-white/50 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Minna no Nihongo Study Portal • JLPT N4 & N3</span>
          <span>Interactive Grammar, Vocabulary & Kanji Reference</span>
        </div>
      </footer>

      <AiSettingsModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        initialError={apiError}
      />
    </div>
  );
}
