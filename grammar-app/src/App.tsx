import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import Header from './components/common/Header';
import GrammarSection from './features/grammar/GrammarSection';
import VocabSection from './features/vocab/VocabSection';
import KanjiSection from './features/kanji/KanjiSection';
import ReadingSection from './features/reading/ReadingSection';
import AiSettingsModal from './components/common/AiSettingsModal';
import { useAiUiStore } from './store/useAiStore';
import { SectionType } from './types/japanese';
import { parseLevel, clampLessonForLevel } from './utils/levels';

// Wrap the route contents to extract URL params and sync with UI
function ContentWrapper() {
  const { level, section, lesson } = useParams<{ level: string; section: string; lesson?: string }>();

  const parsedLevel = parseLevel(level);
  const parsedSection = (section?.toLowerCase() || 'grammar') as SectionType;

  // Default to each level's starting lesson if unspecified, and guard against out-of-range lessons
  const parsedLesson = clampLessonForLevel(parsedLevel, parseInt(lesson || '', 10));

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
      if (!['n5', 'n4', 'n3'].includes(level)) level = 'n3';

      let section = params.get('section') || hash || 'grammar';
      if (!['grammar', 'vocab', 'kanji', 'reading'].includes(section)) section = 'grammar';

      const parsedLevel = parseLevel(level);
      const lesson = clampLessonForLevel(parsedLevel, parseInt(params.get('lesson') || '', 10));

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
          <span>Minna no Nihongo Study Portal • JLPT N5, N4 & N3</span>
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
