import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap, LockKeyhole } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getApiError } from '../lib/api';

export function LoginPage() {
  const { signIn, notice } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/dashboard', { replace: true });
    } catch (reason) {
      setError(getApiError(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand"><span className="brand-mark"><GraduationCap size={22} /></span>École<span className="brand-light">Pilot</span></div>
        <div className="visual-content"><span className="eyebrow light-eyebrow">PLATEFORME DE GESTION SCOLAIRE</span><h1>Pilotez vos écoles.<br /><em>En toute clarté.</em></h1><p>Un espace central pour administrer les tenants, suivre les écoles et gérer les abonnements de la plateforme.</p><div className="visual-illustration"><div className="illustration-card card-main"><div className="illustration-top"><span /><span /><span /></div><div className="illustration-chart"><i /><i /><i /><i /><i /><i /><i /></div><div className="illustration-legend"><b /><span /><b /><span /></div></div><div className="floating-stat"><span className="stat-icon"><GraduationCap size={16} /></span><div><b>Vue consolidée</b><small>Les données, au même endroit</small></div></div><div className="floating-check"><LockKeyhole size={17} /></div></div></div>
        <div className="login-footer">Gestion fiable · Accès sécurisé · Données isolées par tenant</div>
      </section>
      <section className="login-form-panel"><form className="login-form" onSubmit={(event) => void submit(event)}><span className="eyebrow">BON RETOUR</span><h2>Connexion</h2><p className="muted">Utilisez votre compte administrateur pour continuer.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <div className="notice login-notice" role="status">{notice}</div>}
        <label className="field"><span>Adresse e-mail</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nom@ecole.com" /></label>
        <label className="field"><span>Mot de passe</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" /></label>
        <button className="button button-primary button-wide" type="submit" disabled={submitting}>{submitting ? 'Connexion…' : 'Se connecter'} <ArrowRight size={17} /></button>
        <p className="login-security"><LockKeyhole size={14} /> Authentification vérifiée par le serveur</p>
      </form></section>
    </main>
  );
}
