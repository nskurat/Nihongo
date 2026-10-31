import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { setSearchSource } from './services/search/SearchSource';
import { WorkerSearchSource } from './services/search/WorkerSearchSource';
import './index.css';

// Global search runs in a Web Worker over prebuilt index shards; the worker is only
// started when search is first used (warmup on focus).
setSearchSource(new WorkerSearchSource());

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}
