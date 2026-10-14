import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Globe2, Plus, Search } from 'lucide-react';
import { api, getApiError, unwrap } from '../lib/api';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';
import type { PageResult, Tenant } from '../types';

export function TenantsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', domain: '', admin_password: '' });
  const tenants = useQuery({
    queryKey: ['tenants', page],
    queryFn: async () => unwrap(await api.post<PageResult<Tenant>>('/tenants/list', { page, per_page: 10 })),
  });
  const create = useMutation({
    mutationFn: async (values: typeof form) => unwrap(await api.post<Tenant>('/tenants/create', {
      name: values.name.trim(),
      email: values.email.trim(),
      domain: values.domain.trim() || null,
      admin_password: values.admin_password,
    })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setModalOpen(false);
      setForm({ name: '', email: '', domain: '', admin_password: '' });
    },
  });
  const filtered = tenants.data?.data.filter((tenant) => `${tenant.name} ${tenant.domain ?? ''}`.toLowerCase().includes(search.toLowerCase())) ?? [];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    try { await create.mutateAsync(form); }
    catch (error) { setFormError(getApiError(error)); }
  };

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">GESTION DE LA PLATEFORME</span><h1>Tenants</h1><p>Organisez les organisations qui utilisent votre plateforme scolaire.</p></div><button className="button button-primary" onClick={() => setModalOpen(true)}><Plus size={17} /> Nouveau tenant</button></section>
    <section className="panel">
      <div className="table-toolbar"><div><h2>Organisations</h2><span className="muted small">{tenants.data?.total ?? '—'} tenants enregistrés</span></div><label className="search-box"><Search size={16} /><input aria-label="Rechercher un tenant" placeholder="Rechercher…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      {tenants.isLoading && <Loading />}
      {tenants.error && <ErrorState message={getApiError(tenants.error)} />}
      {tenants.data && (filtered.length ? <div className="table-scroll"><table><thead><tr><th>Organisation</th><th>Domaine</th><th>Identifiant</th><th>État</th></tr></thead><tbody>{filtered.map((tenant) => <tr key={tenant.id}><td><div className="table-identity"><span className="table-avatar"><Building2 size={16} /></span><span><b>{tenant.name}</b><small>Compte tenant</small></span></div></td><td><span className="domain-cell"><Globe2 size={14} />{tenant.domain || 'Non configuré'}</span></td><td><code className="id-code">TEN-{String(tenant.id).padStart(4, '0')}</code></td><td><span className="status-pill status-green"><i /> Actif</span></td></tr>)}</tbody></table></div> : <EmptyState message={search ? 'Aucun tenant ne correspond à cette recherche.' : 'Aucun tenant pour le moment. Créez votre premier tenant.'} />)}
      {tenants.data && tenants.data.last_page > 1 && <div className="pagination"><span>Page {tenants.data.current_page} sur {tenants.data.last_page}</span><div><button className="button button-secondary button-small" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Précédent</button><button className="button button-secondary button-small" disabled={page >= tenants.data!.last_page} onClick={() => setPage((current) => current + 1)}>Suivant</button></div></div>}
    </section>
    {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-tenant-heading"><div className="modal-heading"><div><span className="eyebrow">NOUVELLE ORGANISATION</span><h2 id="create-tenant-heading">Créer un tenant</h2></div><button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Fermer">×</button></div><p className="muted modal-description">Le compte administrateur tenant est créé en même temps. Vous pourrez ensuite ajouter une école et configurer l’abonnement.</p><form className="form-grid" onSubmit={(event) => void submit(event)}>
      <label className="field field-full"><span>Nom de l’organisation</span><input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex. Groupe scolaire Horizon" /></label>
      <label className="field"><span>E-mail de l’administrateur</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="admin@ecole.com" /></label>
      <label className="field"><span>Domaine (facultatif)</span><input value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} placeholder="ecole.com" /></label>
      <label className="field field-full"><span>Mot de passe initial</span><input required minLength={8} type="password" autoComplete="new-password" value={form.admin_password} onChange={(event) => setForm({ ...form, admin_password: event.target.value })} placeholder="8 caractères minimum" /></label>
      {formError && <div className="form-error field-full" role="alert">{formError}</div>}
      <div className="modal-actions field-full"><button className="button button-secondary" type="button" onClick={() => setModalOpen(false)}>Annuler</button><button className="button button-primary" disabled={create.isPending} type="submit">{create.isPending ? 'Création…' : 'Créer le tenant'}</button></div>
    </form></section></div>}
  </div>;
}
