import { Compass, BookOpen } from 'lucide-react';
import FuriganaText from '../../components/common/FuriganaText';
import Modal from '../../components/common/Modal';
import { openStoryLabel } from '../../services/ai/readingSession';
import QuestionList, { StartOverButton } from './QuestionList';
import { ReadingStudio } from './useReadingStudio';

/** Quick reader for a saved story, opened from the library. */
export default function StoryModal({ studio }: { studio: ReadingStudio }) {
  const {
    activeLevel,
    modalStory,
    setModalStory,
    resetCount,
    modalUserAnswers,
    handleLoadIntoStudio,
    handleStartOver,
    handleModalSelectOption,
  } = studio;
  if (!modalStory) return null;

  return (
    <Modal
      open
      onClose={() => setModalStory(null)}
      labelledBy="story-modal-title"
      className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
    >
      {/* Modal Header */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-[10px] font-bold rounded uppercase">
              {modalStory.level} Reader
            </span>
            {modalStory.lesson && (
              <span className="text-xs text-slate-300 font-medium">
                • Lesson {modalStory.lesson}
              </span>
            )}
          </div>
          <h3 id="story-modal-title" className="text-xl md:text-2xl font-bold text-white tracking-tight">
            <FuriganaText text={modalStory.data?.title} mode="always" />
          </h3>
          {modalStory.data?.titleEn && (
            <p className="text-xs text-indigo-200 italic mt-0.5">{modalStory.data.titleEn}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLoadIntoStudio(modalStory)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Compass size={13} />
            <span>
              {modalStory.level === activeLevel ? 'Open in Studio' : openStoryLabel(modalStory.level, activeLevel)}
            </span>
          </button>
          <button
            onClick={() => setModalStory(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Modal Body */}
      <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 max-h-[calc(90vh-160px)] scrollbar-thin scrollbar-thumb-slate-300">
        {/* Japanese Text */}
        <div className="text-slate-800 text-base md:text-lg leading-loose space-y-3">
          <FuriganaText text={modalStory.data?.japaneseText} mode="always" />
        </div>

        {/* Translation */}
        {modalStory.data?.englishTranslation && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed italic">
            <strong>Translation:</strong> {modalStory.data.englishTranslation}
          </div>
        )}

        {/* Quick Questions in Modal */}
        <div className="pt-4 border-t border-slate-200 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <BookOpen size={16} className="text-indigo-600" />
              Comprehension Questions ({modalStory.data?.questions?.length || 0})
            </h4>
            {Object.keys(modalUserAnswers).length > 0 && (
              <StartOverButton onClick={() => handleStartOver(modalStory.id)} />
            )}
          </div>

          <QuestionList
            key={`${modalStory.id}:${resetCount}`}
            questions={modalStory.data?.questions ?? []}
            answers={modalUserAnswers}
            onAnswer={handleModalSelectOption}
            variant="compact"
          />
        </div>
      </div>

      {/* Modal Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
        <button
          onClick={() => setModalStory(null)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
        >
          Close Reader
        </button>
      </div>
    </Modal>
  );
}
