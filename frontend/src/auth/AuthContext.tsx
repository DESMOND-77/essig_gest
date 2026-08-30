import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, setAccessToken } from "../api/client";

type Utilisateur = { id: number; login: string; email: string; roles: { code: string }[] };
type Ctx = {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  connexion: (login: string, mdp: string) => Promise<void>;
  deconnexion: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  async function chargerMoi() {
    const r = await apiFetch("/auth/moi/");
    setUtilisateur(r.ok ? await r.json() : null);
  }

  useEffect(() => { chargerMoi().finally(() => setChargement(false)); }, []);

  async function connexion(login: string, mdp: string) {
    const r = await fetch("/api/v1/auth/login/", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password: mdp }),
    });
    if (!r.ok) throw new Error("Identifiants invalides.");
    setAccessToken((await r.json()).access);
    await chargerMoi();
  }

  async function deconnexion() {
    await fetch("/api/v1/auth/logout/", { method: "POST", credentials: "include" });
    setAccessToken(null);
    setUtilisateur(null);
  }

  return (
    <AuthCtx.Provider value={{ utilisateur, chargement, connexion, deconnexion }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth hors AuthProvider");
  return c;
}
