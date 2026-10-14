import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Plus, Search } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useSelectedTenant } from '../auth/TenantContext';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';
import { api, getApiError, unwrap } from '../lib/api';
import type { PageResult, School } from '../types';

export function SchoolsPage() {
  const { user } = useAuth();
  const selectedTenantId = useSelectedTenant();
  const isSuperAdmin = user?.roles.includes('super_admin') ?? false;
  const activeTenantId = user?.tenantId ?? selectedTenantId;
  const [page] = useState(1);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({ name: '', address: '' });
  const queryClient = useQueryClient();
  const schools = useQuery({
    queryKey: ['schools', isSuperAdmin ? 'global' : user?.tenantId, page],
    queryFn: async () => unwrap(await api.post<PageResult<School>>(isSuperAdmin ? '/schools/all' : '/schools/list', { page, per_page: 50 })),
  });
  const create = useMutation({
    mutationFn: async () => unwrap(await api.post<School>('/schools/create', { name: form.name.trim(), address: form.address.trim() })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schools'] });
      setModalOpen(false);
      setForm({ name: '', address: '' });
    },
  });
  const filtered = useMemo(() => schools.data?.data.filter((school) => `${school.name} ${school.address ?? ''} ${school.tenant?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())) ?? [], [schools.data, search]);
  const canCreate = !isSuperAdmin || activeTenantId !== null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    try { await create.mutateAsync(); }
    catch (error) { setErrorMessage(getApiError(error)); }
  };

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">RÉSEAU SCOLAIRE</span><h1>Écoles</h1><p>{isSuperAdmin ? 'Vue globale des établissements enregistrés sur la plateforme.' : 'Établissements associés à votre organisation.'}</p></div><button className="button button-primary" disabled={!canCreate} title={!canCreate ? 'Sélectionnez un tenant dans le menu supérieur.' : undefined} onClick={() => setModalOpen(true)}><Plus size={17} /> Ajouter une école</button></section>
    {isSuperAdmin && !activeTenantId && <div className="notice"><Building2 size={17} /><span>Sélectionnez un tenant dans le menu supérieur pour créer une école.</span></div>}
    <section className="panel">
      <div className="table-toolbar"><div><h2>Établissements</h2><span className="muted small">{schools.data?.total ?? '—'} écoles répertoriées</span></div><label className="search-box"><Search size={16} /><input aria-label="Rechercher une école" placeholder="Nom, adresse ou tenant…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      {schools.isLoading && <Loading />}
      {schools.error && <ErrorState message={getApiError(schools.error)} />}
      {schools.data && (filtered.length ? <div className="table-scroll"><table><thead><tr><th>Établissement</th>{isSuperAdmin && <th>Tenant</th>}<th>Adresse</th><th>ID</th></tr></thead><tbody>{filtered.map((school) => <tr key={school.id}><td><div className="table-identity"><span className="table-avatar school-avatar"><Building2 size={16} /></span><span><b>{school.name}</b><small>Établissement scolaire</small></span></div></td>{isSuperAdmin && <td>{school.tenant?.name ?? `Tenant ${school.tenantId}`}</td>}<td><span className="domain-cell"><MapPin size={14} />{school.address || 'Adresse non renseignée'}</span></td><td><code className="id-code">{school.id}</code></td></tr>)}</tbody></table></div> : <EmptyState message={search ? 'Aucune école ne correspond à cette recherche.' : 'Aucune école enregistrée pour le moment.'} />)}
    </section>
    {modalOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-school-heading"><div className="modal-heading"><div><span className="eyebrow">NOUVEL ÉTABLISSEMENT</span><h2 id="create-school-heading">Ajouter une école</h2></div><button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Fermer">×</button></div><p className="muted modal-description">L’école sera rattachée au tenant actif côté serveur.</p><form className="form-grid" onSubmit={(event) => void submit(event)}><label className="field field-full"><span>Nom de l’école</span><input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field field-full"><span>Adresse</span><textarea maxLength={400} rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>{errorMessage && <div className="form-error field-full" role="alert">{errorMessage}</div>}<div className="modal-actions field-full"><button className="button button-secondary" type="button" onClick={() => setModalOpen(false)}>Annuler</button><button className="button button-primary" disabled={create.isPending} type="submit">{create.isPending ? 'Création…' : 'Enregistrer l’école'}</button></div></form></section></div>}
  </div>;
}
