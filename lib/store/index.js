import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import uiSlice from './slices/uiSlice.js';
import workflowSlice from './slices/workflowSlice.js';
import agentSlice from './slices/agentSlice.js';
import realtimeSlice from './slices/realtimeSlice.js';
import { websocketMiddleware } from './middleware/websocketMiddleware.js';

let persistor = null;
let store = null;

const createStore = () => {
  const baseStore = configureStore({
    reducer: {
      ui: uiSlice.reducer,
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

  if (typeof window !== 'undefined') {
    const { persistStore, persistReducer } = require('redux-persist');
    const storage = require('redux-persist/lib/storage').default;

    const persistConfig = {
      key: 'dream-team-root',
      storage,
      whitelist: ['ui'], // Only persist UI preferences
    };

    const persistedUiReducer = persistReducer(persistConfig, uiSlice.reducer);

    store = configureStore({
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

    persistor = persistStore(store);
  } else {
    store = baseStore;
  }

  setupListeners(store.dispatch);
  return { store, persistor };
};

const { store: finalStore, persistor: finalPersistor } = createStore();

export { finalStore as store, finalPersistor as persistor };

// Type definitions (for TypeScript usage)
// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;