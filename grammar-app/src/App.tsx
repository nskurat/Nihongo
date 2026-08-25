import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import Header from './components/common/Header';
import GrammarSection from './features/grammar/GrammarSection';
import VocabSection from './features/vocab/VocabSection';
import KanjiSection from './features/kanji/KanjiSection';
import ReadingSection from './features/reading/ReadingSection';
import AiSettingsModal from './components/common/AiSettingsModal';
import { useAiUiStore } from './store/useAiStore';
import { SectionType } from './types/japanese';
import { parseLevel, clampLessonForLevel } from './utils/levels';
import { parseLegacyUrl } from './utils/legacyUrl';
import { useReadingData } from './features/reading/useReadingData';

const DEFAULT_ROUTE = '/n3/grammar/1';

// Wrap the route contents to extract URL params and sync with UI
function ContentWrapper() {
  const { level, section, lesson } = useParams<{ level: string; section: string; lesson?: string }>();

  const parsedLevel = parseLevel(level);
  const parsedSection = (section?.toLowerCase() || 'grammar') as SectionType;

  // Default to each level's starting lesson if unspecified, and guard against out-of-range lessons
  const parsedLesson = clampLessonForLevel(parsedLevel, parseInt(lesson || '', 10));
  const { grammarData, vocabData } = useReadingData(parsedLevel);

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
        <ReadingSection activeLevel={parsedLevel} grammarData={grammarData} vocabData={vocabData} />
      )}
    </>
  );
}

// Redirects root and unmatched paths, honoring legacy ?level=&section=&lesson=
// query params and #section hash shortcuts from before the router existed.
function LegacyRedirect() {
  const location = useLocation();
  const target = parseLegacyUrl(location.search, location.hash);
  const to = target
    ? `/${target.level.toLowerCase()}/${target.section}/${target.lesson}`
    : DEFAULT_ROUTE;
  return <Navigate to={to} replace />;
}

export default function App() {
  const { showKeyModal, setShowKeyModal, apiError } = useAiUiStore();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between">
      <div>
        <Header />

        <Routes>
          <Route path="/:level/:section/:lesson" element={<ContentWrapper />} />
          <Route path="/:level/:section" element={<ContentWrapper />} />
          <Route path="/" element={<LegacyRedirect />} />
          <Route path="*" element={<LegacyRedirect />} />
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
