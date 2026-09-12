import { useState, useEffect } from 'react';
import { getCurrentUser, isWithinWorkingHours, logout } from './lib/auth';
import LoginView from './views/LoginView';
import OrderFormView from './views/OrderFormView';
import OrderHistoryView from './views/OrderHistoryView';
import FactoryView from './views/FactoryView';
import FactoryOversightView from './views/FactoryOversightView';
import { ENABLE_FACTORY_SYSTEM } from './constants/featureFlags';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [currentView, setCurrentView] = useState(() => {
    const u = getCurrentUser();
    if (u?.role === 'boss')    return 'oversight';
    if (u?.role === 'cashier') return 'history';
    if (u?.role === 'factory') return 'factory';
    return 'form';
  }); // 'form' | 'history' | 'factory' | 'oversight'
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
    if (user?.role === 'boss')    return setCurrentView('oversight');
    if (user?.role === 'cashier') return setCurrentView('history');
    if (user?.role === 'factory') return setCurrentView('factory');
    setCurrentView('form');
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

  const goToFactory = () => {
    setCurrentView('factory');
    setEditingOrder(null);
  };

  const goToNewOrder = () => {
    if (currentUser?.role === 'cashier' || currentUser?.role === 'factory') return; 
    setCurrentView('form');
    setEditingOrder(null);
  };

  const goToEditOrder = (order) => {
    if (currentUser?.role === 'cashier' || currentUser?.role === 'factory') return; 
    setEditingOrder(order);
    setCurrentView('form');
  };

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  const isCashier = currentUser.role === 'cashier';
  const isFactory = currentUser.role === 'factory';
  const isBoss    = currentUser.role === 'boss';

  // Boss role: read-only production oversight — routed before all other views
  if (isBoss || currentView === 'oversight') {
    return (
      <FactoryOversightView
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  // Factory role is directed exclusively to the Kitchen Display System (KDS) when feature is enabled
  if (ENABLE_FACTORY_SYSTEM && (isFactory || currentView === 'factory')) {
    return (
      <FactoryView
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchToHistory={!isFactory ? goToHistory : null}
      />
    );
  }

  // Cashiers (and factory accounts when KDS is disabled) are directed to the Order History dashboard
  if (isCashier || isFactory || currentView === 'history') {
    return (
      <OrderHistoryView
        currentUser={currentUser}
        onLogout={handleLogout}
        onNewOrder={!isCashier && !isFactory ? goToNewOrder : null}
        onEditOrder={!isCashier && !isFactory ? goToEditOrder : null}
        onFactory={!isCashier ? goToFactory : null}
      />
    );
  }

  return (
    <OrderFormView
      currentUser={currentUser}
      onLogout={handleLogout}
      onHistory={goToHistory}
      onFactory={goToFactory}
      editingOrder={editingOrder}
      onCancelEdit={goToNewOrder}
    />
  );
}
