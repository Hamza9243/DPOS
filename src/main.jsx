import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply theme before React renders
const savedTheme = localStorage.getItem("dpos_theme") || "#1565C0";
document.documentElement.style.setProperty("--theme-color", savedTheme);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)