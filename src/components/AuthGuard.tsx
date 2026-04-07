'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Factory } from 'lucide-react';

interface AuthContextType {
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ isAuthenticated: false, logout: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

const VALID_USER = 'bigkitchen';
const VALID_PASS = 'minttest';
const AUTH_KEY = 'bk_auth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem(AUTH_KEY) : null;
    if (saved === 'true') {
      setIsAuthenticated(true);
    }
    setChecking(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (username === VALID_USER && password === VALID_PASS) {
      setIsAuthenticated(true);
      sessionStorage.setItem(AUTH_KEY, 'true');
    } else {
      setError('Username หรือ Password ไม่ถูกต้อง');
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(AUTH_KEY);
  };

  if (checking) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground">กำลังตรวจสอบ...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-sm mx-4">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Factory className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Big Kitchen</CardTitle>
            <p className="text-sm text-muted-foreground">Production Planner ERP</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md text-center">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full">
                <Lock className="h-4 w-4 mr-2" />
                เข้าสู่ระบบ
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
