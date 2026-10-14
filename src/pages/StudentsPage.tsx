import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Plus, Search } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useSelectedTenant } from '../auth/TenantContext';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';
import { api, getApiError, unwrap } from '../lib/api';
import type { PageResult } from '../types';

interface Student { id: number; firstName: string; lastName: string; gender: string | null; schoolId: number; dateOfBirth: string | null }

export function StudentsPage() {
  const { user } = useAuth();
  const selectedTenantId = useSelectedTenant();
  const activeTenantId = user?.tenantId ?? selectedTenantId;
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', school_id: '', gender: 'M' });
  const queryClient = useQueryClient();
  const schools = useQuery({
    queryKey: ['schools', 'student-form', activeTenantId],
    queryFn: async () => unwrap(await api.post<PageResult<{ id: number; name: string }>>('/schools/list', { page: 1, per_page: 100 })),
    enabled: activeTenantId !== null,
  });
  const students = useQuery({
    queryKey: ['students', activeTenantId],
    queryFn: async () => unwrap(await api.post<PageResult<Student>>('/students/list', { page: 1, per_page: 50 })),
    enabled: activeTenantId !== null,
  });
  const create = useMutation({
    mutationFn: async () => unwrap(await api.post<Student>('/students/create', {
      school_id: form.school_id,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      gender: form.gender,
    })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      setModalOpen(false);
      setForm({ first_name: '', last_name: '', school_id: '', gender: 'M' });
    },
  });
  const filtered = useMemo(() => students.data?.data.filter((student) => `${student.firstName} ${student.lastName}`.toLowerCase().includes(search.toLowerCase())) ?? [], [students.data, search]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    try { await create.mutateAsync(); }
    catch (error) { setFormError(getApiError(error)); }
  };

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">GESTION SCOLAIRE</span><h1>Élèves</h1><p>Consultez et inscrivez les élèves des écoles autorisées de votre tenant.</p></div><button className="button button-primary" disabled={!activeTenantId || !schools.data?.data.length} onClick={() => setModalOpen(true)}><Plus size={17} /> Nouvel élève</button></section>
    {!activeTenantId && <div className="notice"><GraduationCap size={17} /><span>Sélectionnez un tenant dans le menu supérieur pour afficher ses élèves.</span></div>}
    {activeTenantId !== null && <section className="panel"><div className="table-toolbar"><div><h2>Élèves inscrits</h2><span className="muted small">{students.data?.total ?? '—'} profils élèves</span></div><label className="search-box"><Search size={16} /><input aria-label="Rechercher un élève" placeholder="Nom de l’élève…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      {students.isLoading && <Loading />}
      {students.error && <ErrorState message={getApiError(students.error)} />}
      {students.data && (filtered.length ? <div className="table-scroll"><table><thead><tr><th>Élève</th><th>École</th><th>Genre</th><th>Identifiant</th></tr></thead><tbody>{filtered.map((student) => <tr key={student.id}><td><div className="table-identity"><span className="table-avatar student-avatar"><GraduationCap size={16} /></span><span><b>{student.firstName} {student.lastName}</b><small>Profil élève</small></span></div></td><td>{schools.data?.data.find((school) => school.id === student.schoolId)?.name ?? `École ${student.schoolId}`}</td><td>{student.gender ?? '—'}</td><td><code className="id-code">{student.id}</code></td></tr>)}</tbody></table></div> : <EmptyState message={search ? 'Aucun élève ne correspond à cette recherche.' : 'Aucun élève enregistré.'} />)}
    </section>}
    {modalOpen && <div className="modal-backdrop"><section className="modal modal-narrow" role="dialog" aria-modal="true" aria-labelledby="create-student-heading"><div className="modal-heading"><div><span className="eyebrow">NOUVELLE INSCRIPTION</span><h2 id="create-student-heading">Ajouter un élève</h2></div><button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Fermer">×</button></div><form className="form-grid" onSubmit={(event) => void submit(event)}><label className="field"><span>Prénom</span><input required maxLength={255} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label><label className="field"><span>Nom</span><input required maxLength={255} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label><label className="field"><span>École</span><select required value={form.school_id} onChange={(event) => setForm({ ...form, school_id: event.target.value })}><option value="">Choisir une école</option>{schools.data?.data.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label><label className="field"><span>Genre</span><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="M">Masculin</option><option value="F">Féminin</option><option value="Other">Autre</option></select></label>{formError && <div className="form-error field-full" role="alert">{formError}</div>}<div className="modal-actions field-full"><button className="button button-secondary" type="button" onClick={() => setModalOpen(false)}>Annuler</button><button className="button button-primary" disabled={create.isPending} type="submit">{create.isPending ? 'Création…' : 'Créer l’élève'}</button></div></form></section></div>}
  </div>;
}
