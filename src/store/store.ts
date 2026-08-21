import { configureStore } from '@reduxjs/toolkit';
import resumeReducer from './resumeSlice';
import { undoRedoMiddleware } from './undoMiddleware';

export const store = configureStore({
  reducer: {
    resume: resumeReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(undoRedoMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;