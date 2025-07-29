import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage/index.js';

import uiSlice from './slices/uiSlice.js';
import workflowSlice from './slices/workflowSlice.js';
import agentSlice from './slices/agentSlice.js';
import realtimeSlice from './slices/realtimeSlice.js';
import { websocketMiddleware } from './middleware/websocketMiddleware.js';

const persistConfig = {
  key: 'dream-team-root',
  storage,
  whitelist: ['ui'], // Only persist UI preferences
};

const persistedUiReducer = persistReducer(persistConfig, uiSlice.reducer);

export const store = configureStore({
  reducer: {
    ui: persistedUiReducer,
    workflow: workflowSlice.reducer,
    agents: agentSlice.reducer,
    realtime: realtimeSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'realtime/websocketConnected',
          'realtime/liveUpdateReceived'
        ],
        ignoredPaths: ['realtime.connections', 'realtime.webSocketInstances']
      }
    }).prepend(websocketMiddleware.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

setupListeners(store.dispatch);
export const persistor = persistStore(store);

// Type definitions (for TypeScript usage)
// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;