import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster, toast } from 'react-hot-toast';
import './app.js';

window.innerEarToast = {
  show(message, tone = 'blank') {
    if (tone === 'success') {
      toast.success(message, { duration: 1500 });
      return;
    }

    if (tone === 'warning') {
      toast(message, {
        duration: 1700,
        icon: '⚠️',
      });
      return;
    }

    toast(message, { duration: 1500 });
  },
  dismiss() {
    toast.dismiss();
  },
};

let host = document.getElementById('exerciseToastHost');
if (!host) {
  host = document.createElement('div');
  host.id = 'exerciseToastHost';
  document.body.appendChild(host);
}

createRoot(host).render(
  <React.StrictMode>
    <Toaster
      position='top-center'
      gutter={10}
      containerStyle={{
        top: 16,
        left: 16,
        right: 16,
        zIndex: 2147483647,
      }}
      toastOptions={{
        duration: 1500,
        style: {
          background: 'rgba(10, 14, 28, 0.96)',
          color: '#f7f7fb',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '14px',
          boxShadow: '0 18px 50px rgba(0,0,0,0.32)',
          maxWidth: '520px',
          width: 'auto',
          lineHeight: '1.35',
          fontFamily: "'Space Grotesk', 'Avenir Next', 'Segoe UI', sans-serif",
        },
      }}
    />
  </React.StrictMode>,
);
