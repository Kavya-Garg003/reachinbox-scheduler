import { createContext, useContext } from 'react';
import { User } from '../lib/types';

interface AuthCtx { user: User; logout: () => Promise<void> }
export const AuthContext = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(AuthContext);
