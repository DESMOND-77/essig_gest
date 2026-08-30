import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

afterEach(() => vi.restoreAllMocks());

function Sonde() {
  const { utilisateur, connexion } = useAuth();
  return (
    <div>
      <span>utilisateur:{utilisateur?.login ?? "aucun"}</span>
      <button onClick={() => connexion("compta", "motdepasse42")}>go</button>
    </div>
  );
}

test("connexion renseigne l'utilisateur", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.endsWith("/auth/moi/"))
      return Promise.resolve(new Response(JSON.stringify(
        { id: 1, login: "compta", email: "c@ex.ga", roles: [] }), { status: 200 }));
    if (url.endsWith("/auth/login/"))
      return Promise.resolve(new Response(JSON.stringify({ access: "x" }), { status: 200 }));
    return Promise.resolve(new Response("{}", { status: 200 }));
  }));
  render(<AuthProvider><Sonde /></AuthProvider>);
  await userEvent.click(await screen.findByText("go"));
  await screen.findByText("utilisateur:compta");
  expect(screen.getByText("utilisateur:compta")).toBeInTheDocument();
});
