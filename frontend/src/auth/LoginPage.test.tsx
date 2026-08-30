import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { LoginPage } from "./LoginPage";

function monter() {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ roles: [] }), { status: 200 }))));
  return render(
    <MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>,
  );
}

test("valide la longueur du mot de passe", async () => {
  monter();
  await userEvent.type(screen.getByLabelText("Login"), "compta");
  await userEvent.type(screen.getByLabelText("Mot de passe"), "court");
  await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
  expect(await screen.findByText("Au moins 10 caractères")).toBeInTheDocument();
});
