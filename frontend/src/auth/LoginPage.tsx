import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAuth } from "./AuthContext";

const schema = z.object({
  login: z.string().min(1, "Login requis"),
  password: z.string().min(10, "Au moins 10 caractères"),
});
type Champs = z.infer<typeof schema>;

export function LoginPage() {
  const { connexion } = useAuth();
  const nav = useNavigate();
  const [erreur, setErreur] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Champs>({ resolver: zodResolver(schema) });

  async function onSubmit(v: Champs) {
    setErreur("");
    try { await connexion(v.login, v.password); nav("/"); }
    catch { setErreur("Identifiants invalides."); }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto mt-24 max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Connexion</h1>
      <label className="block">
        <span className="text-sm">Login</span>
        <input className="mt-1 w-full rounded border p-2" {...register("login")} />
        {errors.login && <em className="text-sm text-red-600">{errors.login.message}</em>}
      </label>
      <label className="block">
        <span className="text-sm">Mot de passe</span>
        <input type="password" className="mt-1 w-full rounded border p-2" {...register("password")} />
        {errors.password && <em className="text-sm text-red-600">{errors.password.message}</em>}
      </label>
      {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">Se connecter</Button>
    </form>
  );
}
