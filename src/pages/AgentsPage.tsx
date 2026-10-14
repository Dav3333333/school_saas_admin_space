import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, UserRound, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useSelectedTenant } from '../auth/TenantContext';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';
import { api, getApiError, unwrap } from '../lib/api';
import type { Agent, PageResult } from '../types';

type StaffRole = 'teacher' | 'school_director' | 'accountant';

export function AgentsPage() {
  const { user } = useAuth();
  const selectedTenantId = useSelectedTenant();
  const activeTenantId = user?.tenantId ?? selectedTenantId;
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', school_id: '', phone: '', qualification: '', role: 'teacher' as StaffRole });
  const queryClient = useQueryClient();
  const agents = useQuery({
    queryKey: ['agents', activeTenantId],
    queryFn: async () => unwrap(await api.post<PageResult<Agent>>('/agents', { page: 1, per_page: 50 })),
    enabled: activeTenantId !== null,
  });
  const schools = useQuery({
    queryKey: ['schools', 'for-agents', activeTenantId],
    queryFn: async () => unwrap(await api.post<PageResult<{ id: number; name: string }>>('/schools/list', { page: 1, per_page: 100 })),
    enabled: activeTenantId !== null,
  });
  const create = useMutation({
    mutationFn: async () => {
      const paths: Record<StaffRole, string> = {
        teacher: '/teachers/profiles/create/teacher',
        school_director: '/teachers/profiles/create/director',
        accountant: '/teachers/profiles/create/accountant',
      };
      return unwrap(await api.post<Agent>(paths[form.role], {
        school_id: form.school_id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
        qualification: form.qualification.trim() || null,
        status: 'active',
      }));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agents'] });
      setModalOpen(false);
      setForm({ first_name: '', last_name: '', email: '', password: '', school_id: '', phone: '', qualification: '', role: 'teacher' });
    },
  });
  const filtered = useMemo(() => agents.data?.data.filter((agent) => `${agent.firstName} ${agent.lastName} ${agent.user?.email ?? ''}`.toLowerCase().includes(query.toLowerCase())) ?? [], [agents.data, query]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    try { await create.mutateAsync(); }
    catch (error) { setFormError(getApiError(error)); }
  };

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">ÉQUIPE SCOLAIRE</span><h1>Agents</h1><p>Gérez les enseignants, directeurs et comptables de l’organisation sélectionnée.</p></div><button className="button button-primary" disabled={!activeTenantId || !schools.data?.data.length} onClick={() => setModalOpen(true)}><Plus size={17} /> Nouvel agent</button></section>
    {!activeTenantId && <div className="notice"><Users size={17} /><span>Choisissez un tenant dans le menu supérieur pour consulter son équipe.</span></div>}
    {activeTenantId !== null && <section className="panel"><div className="table-toolbar"><div><h2>Équipe</h2><span className="muted small">{agents.data?.total ?? '—'} profils actifs ou enregistrés</span></div><label className="search-box"><Search size={16} /><input aria-label="Rechercher un agent" placeholder="Rechercher un agent…" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      {agents.isLoading && <Loading />}
      {agents.error && <ErrorState message={getApiError(agents.error)} />}
      {agents.data && (filtered.length ? <div className="table-scroll"><table><thead><tr><th>Agent</th><th>Adresse e-mail</th><th>École</th><th>Statut</th></tr></thead><tbody>{filtered.map((agent) => <tr key={agent.id}><td><div className="table-identity"><span className="table-avatar agent-avatar"><UserRound size={16} /></span><span><b>{agent.firstName} {agent.lastName}</b><small>Profil scolaire #{agent.id}</small></span></div></td><td>{agent.user?.email ?? '—'}</td><td>{schools.data?.data.find((school) => school.id === agent.schoolId)?.name ?? `École ${agent.schoolId}`}</td><td><span className={`status-pill ${agent.status === 'active' ? 'status-green' : 'status-gray'}`}><i />{agent.status === 'active' ? 'Actif' : agent.status}</span></td></tr>)}</tbody></table></div> : <EmptyState message={query ? 'Aucun agent ne correspond à cette recherche.' : 'Aucun agent enregistré.'} />)}
    </section>}
    {modalOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-agent-heading"><div className="modal-heading"><div><span className="eyebrow">NOUVEAU COMPTE SCOLAIRE</span><h2 id="create-agent-heading">Ajouter un agent</h2></div><button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Fermer">×</button></div><p className="muted modal-description">Le profil et le compte d’accès sont créés par le backend dans le tenant sélectionné.</p><form className="form-grid" onSubmit={(event) => void submit(event)}>
      <label className="field"><span>Prénom</span><input required maxLength={255} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
      <label className="field"><span>Nom</span><input required maxLength={255} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label>
      <label className="field field-full"><span>Adresse e-mail</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label className="field"><span>Rôle scolaire</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as StaffRole })}><option value="teacher">Enseignant</option><option value="school_director">Directeur</option><option value="accountant">Comptable</option></select></label>
      <label className="field"><span>École</span><select required value={form.school_id} onChange={(event) => setForm({ ...form, school_id: event.target.value })}><option value="">Choisir une école</option>{schools.data?.data.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
      <label className="field field-full"><span>Mot de passe initial</span><input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      <label className="field"><span>Téléphone (facultatif)</span><input maxLength={20} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label className="field"><span>Qualification (facultatif)</span><input maxLength={255} value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })} /></label>
      {formError && <div className="form-error field-full" role="alert">{formError}</div>}
      <div className="modal-actions field-full"><button className="button button-secondary" type="button" onClick={() => setModalOpen(false)}>Annuler</button><button className="button button-primary" disabled={create.isPending} type="submit">{create.isPending ? 'Création…' : 'Créer le profil'}</button></div>
    </form></section></div>}
  </div>;
}
