import { useState, useEffect, useRef } from 'react';
import { getCurrentUser, isWithinWorkingHours, logout, subscribeToAuth } from './lib/auth';
import { syncOfflineQueue } from './lib/ordersStore';
import LoginView from './views/LoginView';
import OrderFormView from './views/OrderFormView';
import OrderHistoryView from './views/OrderHistoryView';
import FactoryView from './views/FactoryView';
import FactoryOversightView from './views/FactoryOversightView';
import { ENABLE_FACTORY_SYSTEM } from './constants/featureFlags';
import Modal from './components/ui/Modal';

function defaultViewFor(user) {
  if (user?.role === 'boss')    return 'oversight';
  if (user?.role === 'cashier') return 'history';
  if (user?.role === 'factory') return 'factory';
  return 'form';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [shiftAlert, setShiftAlert] = useState(false);
  const [currentView, setCurrentView] = useState(() => defaultViewFor(getCurrentUser())); // 'form' | 'history' | 'factory' | 'oversight'
  const [editingOrder, setEditingOrder] = useState(null); // null = new order mode

  // Re-validate the cached session against Firebase Auth: the role always
  // comes from the verified ID token claim, never from localStorage.
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  useEffect(() => {
    return subscribeToAuth((verifiedUser) => {
      const prev = currentUserRef.current;
      if (prev?.username !== verifiedUser?.username || prev?.role !== verifiedUser?.role) {
        setCurrentView(defaultViewFor(verifiedUser));
        setEditingOrder(null);
      }
      setCurrentUser(verifiedUser);
    });
  }, []);

  // Automatic Offline Queue Sync (on app load and whenever internet reconnects)
  useEffect(() => {
    syncOfflineQueue();
    const handleOnline = () => syncOfflineQueue();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Real-time Working Hours Enforcement (Checks clock every 30 seconds)
  useEffect(() => {
    if (!currentUser) return;
    const checkHours = () => {
      if (!isWithinWorkingHours(currentUser.role)) {
        logout().then(() => {
          setCurrentUser(null);
          setCurrentView('form');
          setEditingOrder(null);
          setShiftAlert(true);
        });
      }
    };
    checkHours();
    const timer = setInterval(checkHours, 30000);
    return () => clearInterval(timer);
  }, [currentUser]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setCurrentView(defaultViewFor(user));
  };

  const handleLogout = () => {
    // Always end the Firebase session too (some views only call onLogout).
    logout();
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
    return (
      <>
        <LoginView onLogin={handleLogin} />
        <Modal
          isOpen={shiftAlert}
          type="alert"
          title="⏰ ساعات العمل الرسمية"
          message="انتهت ساعات العمل الرسمية (10:00 مساءً). تم تسجيل الخروج تلقائياً وفقاً للسياسة المعتمدة."
          confirmText="حسناً"
          onConfirm={() => setShiftAlert(false)}
          onCancel={() => setShiftAlert(false)}
        />
      </>
    );
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
