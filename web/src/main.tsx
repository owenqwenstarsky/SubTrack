import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import { LoginPage } from './pages/LoginPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { AddSubscriptionPage } from './pages/AddSubscriptionPage';
import { SubscriptionDetailsPage } from './pages/SubscriptionDetailsPage';
import { EditSubscriptionPage } from './pages/EditSubscriptionPage';
import { TimelinePage } from './pages/TimelinePage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<SubscriptionsPage />} />
        <Route path="/subscriptions/new" element={<AddSubscriptionPage />} />
        <Route path="/subscriptions/:id" element={<SubscriptionDetailsPage />} />
        <Route path="/subscriptions/:id/edit" element={<EditSubscriptionPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
