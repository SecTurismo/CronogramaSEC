import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

import { User } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  teamMember: any | null;
  loading: boolean;
  settings: any | null;
  logout: () => Promise<void>;
  loginAsTeamMember: (member: any) => void;
  refreshSettings: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [teamMember, setTeamMember] = useState<any | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const applySettings = useCallback((data: any) => {
    // Merge with localStorage images
    const localImages = {
      faviconUrl: localStorage.getItem('favicon'),
      logoTitleUrl: localStorage.getItem('logoCabecalho'),
      logoLoginTopUrl: localStorage.getItem('logoLoginTopo'),
      loginBackgroundUrl: localStorage.getItem('fundoLogin'),
      logoLoginBottomUrl: localStorage.getItem('logoLoginBase'),
      headerImageUrl: localStorage.getItem('bannerCabecalho'),
    };

    const mergedData = { ...data };
    Object.entries(localImages).forEach(([key, value]) => {
      if (value) mergedData[key] = value;
    });

    if (mergedData.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', mergedData.primaryColor);
      const hex = mergedData.primaryColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        document.documentElement.style.setProperty('--primary-color-rgb', `${r}, ${g}, ${b}`);
      }
    }

    if (mergedData.tabTitle || mergedData.appName) {
      document.title = mergedData.tabTitle || mergedData.appName;
    }

    if (mergedData.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = mergedData.faviconUrl;
    }
  }, []);

  const refreshSettings = useCallback(() => {
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'app_config'), (doc) => {
      const localImages = {
        faviconUrl: localStorage.getItem('favicon'),
        logoTitleUrl: localStorage.getItem('logoCabecalho'),
        logoLoginTopUrl: localStorage.getItem('logoLoginTopo'),
        loginBackgroundUrl: localStorage.getItem('fundoLogin'),
        logoLoginBottomUrl: localStorage.getItem('logoLoginBase'),
        headerImageUrl: localStorage.getItem('bannerCabecalho'),
      };

      let data: any = {
        appName: 'Meu Cronograma',
        primaryColor: '#3b82f6',
      };

      if (doc.exists()) {
        data = { ...data, ...doc.data() };
      }

      // Merge with local storage
      Object.entries(localImages).forEach(([key, value]) => {
        if (value) data[key] = value;
      });

      setSettings(data);
      applySettings(data);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching settings:", err);
      // Even if firestore fails, load local images
      const localImages = {
        faviconUrl: localStorage.getItem('favicon'),
        logoTitleUrl: localStorage.getItem('logoCabecalho'),
        logoLoginTopUrl: localStorage.getItem('logoLoginTopo'),
        loginBackgroundUrl: localStorage.getItem('fundoLogin'),
        logoLoginBottomUrl: localStorage.getItem('logoLoginBase'),
        headerImageUrl: localStorage.getItem('bannerCabecalho'),
      };
      const data = {
        appName: 'Meu Cronograma',
        primaryColor: '#3b82f6',
        ...localImages
      };
      setSettings(data);
      applySettings(data);
      setLoading(false);
    });
    return unsubscribeSettings;
  }, [applySettings]);

  useEffect(() => {
    const savedMember = localStorage.getItem('team_member_session');
    if (savedMember) {
      try {
        setTeamMember(JSON.parse(savedMember));
      } catch (e) {
        localStorage.removeItem('team_member_session');
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    const unsubscribeSettings = refreshSettings();

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
    };
  }, [refreshSettings]);

  const logout = async () => {
    await signOut(auth);
    setTeamMember(null);
    localStorage.removeItem('team_member_session');
  };

  const loginAsTeamMember = (member: any) => {
    setTeamMember(member);
    localStorage.setItem('team_member_session', JSON.stringify(member));
  };

  return (
    <AuthContext.Provider value={{ user, teamMember, loading, settings, logout, loginAsTeamMember, refreshSettings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
