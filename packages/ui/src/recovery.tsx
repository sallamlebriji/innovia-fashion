"use client";
import { useEffect, useState } from "react";
const recoveryWords = {
  en: {
    close: "Close recovery",
    forgot: "Forgot your password?",
    choose: "Choose a new password",
    restore: "Restore your account",
    password: "New password",
    email: "Email address",
    wait: "Please wait…",
    change: "Change password",
    send: "Send recovery link",
    retry: "Please try again.",
    sent: "If this email has an account, a private recovery link will be sent.",
    changed: "Password changed. Sign in with your new password.",
  },
  fr: {
    close: "Fermer la récupération",
    forgot: "Mot de passe oublié ?",
    choose: "Choisir un nouveau mot de passe",
    restore: "Récupérer votre compte",
    password: "Nouveau mot de passe",
    email: "Adresse e-mail",
    wait: "Veuillez patienter…",
    change: "Changer le mot de passe",
    send: "Envoyer le lien de récupération",
    retry: "Veuillez réessayer.",
    sent: "Si un compte correspond à cette adresse, un lien privé de récupération sera envoyé.",
    changed:
      "Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.",
  },
  ar: {
    close: "إغلاق استعادة الحساب",
    forgot: "نسيت كلمة المرور؟",
    choose: "اختر كلمة مرور جديدة",
    restore: "استعادة حسابك",
    password: "كلمة المرور الجديدة",
    email: "البريد الإلكتروني",
    wait: "يرجى الانتظار…",
    change: "تغيير كلمة المرور",
    send: "إرسال رابط الاستعادة",
    retry: "يرجى المحاولة مجدداً.",
    sent: "إذا كان هذا البريد مرتبطاً بحساب، فسيتم إرسال رابط خاص لاستعادته.",
    changed: "تم تغيير كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.",
  },
};
export function AccountRecovery({
  endpoint,
  locale = "en",
}: {
  endpoint: string;
  locale?: string;
}) {
  const text =
    recoveryWords[locale as keyof typeof recoveryWords] ?? recoveryWords.en;
  const [open, setOpen] = useState(false),
    [token, setToken] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("recovery");
    if (value) {
      setToken(value);
      setOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  return (
    <div className="recovery-panel">
      <button
        type="button"
        className="text-button account-text-button"
        onClick={() => setOpen(!open)}
      >
        {open ? text.close : text.forgot}
      </button>
      {open && (
        <form
          className="store-checkout"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            setMessage("");
            const form = new FormData(event.currentTarget);
            try {
              const response = await fetch(
                `${endpoint}/${token ? "reset" : "request"}`,
                {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(
                    token
                      ? { token, password: form.get("password") }
                      : { email: form.get("email") },
                  ),
                },
              );
              const data = await response.json();
              if (!response.ok)
                throw new Error(data.error?.message ?? text.retry);
              setMessage(token ? text.changed : text.sent);
              if (token) setToken("");
            } catch (err) {
              setError(err instanceof Error ? err.message : text.retry);
            } finally {
              setPending(false);
            }
          }}
        >
          <h3>{token ? text.choose : text.restore}</h3>
          <label>
            {token ? text.password : text.email}
            <input
              key={token ? "password" : "email"}
              name={token ? "password" : "email"}
              type={token ? "password" : "email"}
              required
              minLength={token ? 12 : undefined}
              maxLength={token ? 72 : 254}
              autoComplete={token ? "new-password" : "email"}
            />
          </label>
          <button
            className="button button-primary store-cta dark"
            disabled={pending}
          >
            {pending ? text.wait : token ? text.change : text.send}
          </button>
          {message && <p role="status">{message}</p>}
          {error && (
            <p role="alert" className="store-error">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
