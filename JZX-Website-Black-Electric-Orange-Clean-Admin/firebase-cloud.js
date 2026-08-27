(() => {
  'use strict';

  const rootConfig = window.JZX_ADMIN_CONFIG || {};
  const cloudConfig = rootConfig.firebase || {};
  const firebaseConfig = cloudConfig.config || {};
  let app = null;
  let db = null;
  let auth = null;

  const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const validDocumentPath = value => {
    const parts = String(value || '').split('/').filter(Boolean);
    return parts.length >= 2 && parts.length % 2 === 0;
  };

  const enabled = () => Boolean(
    rootConfig.productionMode &&
    cloudConfig.enabled &&
    requiredConfigKeys.every(key => String(firebaseConfig[key] || '').trim()) &&
    validDocumentPath(cloudConfig.settingsDoc)
  );

  const init = () => {
    if (!enabled()) throw new Error('Firebase cloud mode is not fully configured.');
    if (!window.firebase?.initializeApp) throw new Error('Firebase App SDK did not load.');
    if (!window.firebase?.firestore) throw new Error('Cloud Firestore SDK did not load.');

    app = app || window.firebase.apps?.[0] || window.firebase.initializeApp(firebaseConfig);
    db = db || app.firestore();
    if (!auth && typeof app.auth === 'function') auth = app.auth();
    return { app, db, auth };
  };

  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  const isAuthorizedUser = user => Boolean(
    user?.emailVerified &&
    normalizeEmail(user.email) === normalizeEmail(rootConfig.allowedGoogleEmail)
  );

  const requireAdmin = () => {
    const services = init();
    if (!services.auth?.currentUser) throw new Error('Sign in with the authorized Google account before publishing.');
    if (!isAuthorizedUser(services.auth.currentUser)) throw new Error('This Google account is not authorized to publish changes.');
    return services;
  };

  const loadSettings = async () => {
    const { db: firestore } = init();
    const snapshot = await firestore.doc(cloudConfig.settingsDoc).get({ source: 'server' });
    return snapshot.exists ? snapshot.data() : null;
  };

  const saveSettings = async settings => {
    const { db: firestore } = requireAdmin();
    const payload = JSON.parse(JSON.stringify(settings || {}));
    await firestore.doc(cloudConfig.settingsDoc).set(payload);
  };

  const signIn = async () => {
    const services = init();
    if (!services.auth || !window.firebase?.auth?.GoogleAuthProvider) {
      throw new Error('Firebase Authentication SDK did not load.');
    }
    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
      login_hint: rootConfig.allowedGoogleEmail || ''
    });
    const result = await services.auth.signInWithPopup(provider);
    if (!isAuthorizedUser(result.user)) {
      await services.auth.signOut();
      throw new Error('This Google account is not authorized to open the administrator.');
    }
    return result.user;
  };

  const signOut = async () => {
    const services = init();
    if (services.auth) await services.auth.signOut();
  };

  const onAuthStateChanged = callback => {
    const services = init();
    if (!services.auth) throw new Error('Firebase Authentication SDK did not load.');
    return services.auth.onAuthStateChanged(callback);
  };

  const currentMonthKey = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago', year: 'numeric', month: '2-digit'
      }).formatToParts(new Date());
      return `${parts.find(x => x.type === 'year')?.value}-${parts.find(x => x.type === 'month')?.value}`;
    } catch {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  };

  const trafficPaths = () => {
    const globalPath = String(cloudConfig.trafficGlobalDoc || 'siteTraffic/global');
    const monthlyPrefix = String(cloudConfig.trafficMonthlyPrefix || 'siteTraffic/monthly-');
    if (!validDocumentPath(globalPath) || !validDocumentPath(`${monthlyPrefix}${currentMonthKey()}`)) {
      throw new Error('Firestore traffic document paths are invalid.');
    }
    return {
      monthKey: currentMonthKey(),
      globalPath,
      monthlyPath: `${monthlyPrefix}${currentMonthKey()}`
    };
  };

  const incrementTraffic = async () => {
    const { db: firestore } = init();
    const { globalPath, monthlyPath } = trafficPaths();
    const change = {
      count: window.firebase.firestore.FieldValue.increment(1),
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };
    const batch = firestore.batch();
    batch.set(firestore.doc(globalPath), change, { merge: true });
    batch.set(firestore.doc(monthlyPath), change, { merge: true });
    await batch.commit();
  };

  const loadTrafficStats = async () => {
    const { db: firestore } = requireAdmin();
    const { monthKey, globalPath, monthlyPath } = trafficPaths();
    const [globalSnapshot, monthlySnapshot] = await Promise.all([
      firestore.doc(globalPath).get({ source: 'server' }),
      firestore.doc(monthlyPath).get({ source: 'server' })
    ]);
    return {
      monthKey,
      global: Number(globalSnapshot.data()?.count || 0),
      monthly: Number(monthlySnapshot.data()?.count || 0)
    };
  };

  window.JZXCloud = {
    enabled,
    init,
    currentUser: () => init().auth?.currentUser || null,
    isAuthorizedUser,
    loadSettings,
    saveSettings,
    signIn,
    signOut,
    onAuthStateChanged,
    incrementTraffic,
    loadTrafficStats
  };
})();
