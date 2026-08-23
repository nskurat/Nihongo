import AiSettingsModal from './AiSettingsModal';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  return <AiSettingsModal isOpen={isOpen} onClose={onClose} />;
}
