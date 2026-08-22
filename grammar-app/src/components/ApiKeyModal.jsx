import AiSettingsModal from './AiSettingsModal';

// Re-export for backward compatibility
export default function ApiKeyModal({ isOpen, onClose, onSaveKey, currentKey, initialError }) {
  return (
    <AiSettingsModal
      isOpen={isOpen}
      onClose={onClose}
      initialError={initialError}
    />
  );
}
