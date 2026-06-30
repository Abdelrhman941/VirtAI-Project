import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { setupApiAuthWiring } from './bootstrap/apiWiring';
import './styles/index.css';

setupApiAuthWiring();

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
