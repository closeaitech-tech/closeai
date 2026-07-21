import React, { useState, useEffect } from 'react';
import ModalWrapper from './ModalWrapper';
import { apiCall } from '../../utils/api';
import { Loader2 } from 'lucide-react';

export default function NotificationsModal({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall('/api/notifications/push')
      .then(res => setNotifications(res.notifications || []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ModalWrapper title="Notifications" onClose={onClose}>
      <div className="max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-[var(--accent)]" /></div>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No new notifications</p>
        ) : (
          notifications.map(n => (
            <div key={n.id} className="px-3 py-2 border-b border-[var(--border-color)] last:border-0">
              <p className="text-sm text-[var(--text-primary)]">{n.message}</p>
              <span className="text-xs text-[var(--text-tertiary)]">{n.created ? new Date(n.created).toLocaleTimeString() : ''}</span>
            </div>
          ))
        )}
      </div>
    </ModalWrapper>
  );
}
