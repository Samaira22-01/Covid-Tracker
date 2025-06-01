import React from 'react';
import ReactDOM from 'react-dom/client'; // Import from 'react-dom/client'
import './index.css'; // Make sure this line is present and points to your Tailwind CSS file
import App from './App';
// import reportWebVitals from './reportWebVitals'; // reportWebVitals is optional and can be removed if not used

const root = ReactDOM.createRoot(document.getElementById('root')); // Create a root
root.render(

    <App />

);