import { useEffect } from 'react';
import { startEditorPersistence } from '../utils/editorPersistence';

export const useAutoSave = () => {
  useEffect(() => startEditorPersistence(), []);
};
