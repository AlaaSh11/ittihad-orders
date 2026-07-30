import { useState, useEffect } from 'react';
import { getCurrentUser, isWithinWorkingHours, logout } from './lib/auth';
import LoginView from './views/LoginView';
import OrderFormView from './views/OrderFormView';
import OrderHistoryView from './views/OrderHistoryView';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [currentView, setCurrentView] = useState(() => {
    const u = getCurrentUser();
    return u?.role === 'cashier' ? 'history' : 'form';
  }); // 'form' | 'history'
  const [editingOrder, setEditingOrder] = useState(null); // null = new order mode

  // Real-time Working Hours Enforcement (Checks clock every 30 seconds)
  useEffect(() => {
    if (!currentUser) return;
    const checkHours = () => {
      if (!isWithinWorkingHours(currentUser.role)) {
        logout().then(() => {
          setCurrentUser(null);
          setCurrentView('form');
          setEditingOrder(null);
          alert('⏰ انتهت ساعات العمل الرسمية (10:00 مساءً). تم تسجيل الخروج تلقائياً.');
        });
      }
    };
    checkHours();
    const timer = setInterval(checkHours, 30000);
    return () => clearInterval(timer);
  }, [currentUser]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setCurrentView(user?.role === 'cashier' ? 'history' : 'form');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('form');
    setEditingOrder(null);
  };

  // Navigation handlers
  const goToHistory = () => {
    setCurrentView('history');
    setEditingOrder(null);
  };

  const goToNewOrder = () => {
    if (currentUser?.role === 'cashier') return; // cashiers cannot access order creation form
    setCurrentView('form');
    setEditingOrder(null);
  };

  const goToEditOrder = (order) => {
    if (currentUser?.role === 'cashier') return; // cashiers cannot access order creation form
    setEditingOrder(order);
    setCurrentView('form');
  };

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  // Cashiers are restricted exclusively to the Order History & Payment management dashboard
  const isCashier = currentUser.role === 'cashier';

  if (isCashier || currentView === 'history') {
    return (
      <OrderHistoryView
        currentUser={currentUser}
        onLogout={handleLogout}
        onNewOrder={!isCashier ? goToNewOrder : null}
        onEditOrder={!isCashier ? goToEditOrder : null}
      />
    );
  }

  return (
    <OrderFormView
      currentUser={currentUser}
      onLogout={handleLogout}
      onHistory={goToHistory}
      editingOrder={editingOrder}
      onCancelEdit={goToNewOrder}
    />
  );
}
