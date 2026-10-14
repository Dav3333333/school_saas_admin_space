import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, CircleCheck, CirclePause, FileClock, Plus, RefreshCw } from 'lucide-react';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';
import { api, getApiError, unwrap } from '../lib/api';
import type { ModuleAccess, PageResult, PlatformBillingConfig, SaasInvoice, Subscription, Tenant } from '../types';

function monthNow(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(monthNow());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const config = useQuery({
    queryKey: ['billing-config'],
    queryFn: async () => unwrap(await api.post<PlatformBillingConfig>('/platform/billing/config', {})),
  });
  const subscriptions = useQuery({
    queryKey: ['platform-subscriptions'],
    queryFn: async () => unwrap(await api.post<PageResult<Subscription>>('/platform/subscriptions/list', { page: 1, per_page: 100 })),
  });
  const moduleAccess = useQuery({
    queryKey: ['platform-module-subscriptions'],
    queryFn: async () => unwrap(await api.post<ModuleAccess[]>('/platform/module-subscriptions/list', {})),
  });
  const invoices = useQuery({
    queryKey: ['saas-invoices'],
    queryFn: async () => unwrap(await api.post<PageResult<SaasInvoice>>('/platform/billing/invoices/list', { page: 1, per_page: 50 })),
  });
  const tenants = useQuery({
    queryKey: ['tenants', 'subscriptions'],
    queryFn: async () => unwrap(await api.post<PageResult<Tenant>>('/tenants/list', { page: 1, per_page: 100 })),
  });

  const activeTenantIds = useMemo(() => new Set((subscriptions.data?.data ?? []).filter((item) => item.status === 'active').map((item) => item.tenantId)), [subscriptions.data]);
  const availableTenants = tenants.data?.data.filter((tenant) => !activeTenantIds.has(tenant.id)) ?? [];

  const updateConfig = useMutation({
    mutationFn: async (values: { student_unit_price: string; agent_unit_price: string; currency: string }) => unwrap(await api.post<PlatformBillingConfig>('/platform/billing/config/update', values)),
    onSuccess: async () => {
      setMessage('Tarification mise à jour.');
      await queryClient.invalidateQueries({ queryKey: ['billing-config'] });
    },
  });
  const generate = useMutation({
    mutationFn: async () => unwrap(await api.post<{ month: string; attempted: number; created: number }>('/platform/billing/invoices/generate', { month })),
    onSuccess: async (result) => {
      setMessage(`${result.created} facture(s) créée(s) pour ${result.month} (${result.attempted} tenant(s) éligible(s)).`);
      await queryClient.invalidateQueries({ queryKey: ['saas-invoices'] });
    },
  });
  const createSubscription = useMutation({
    mutationFn: async (tenantId: number) => unwrap(await api.post<Subscription>('/platform/subscriptions/create', { tenant_id: tenantId })),
    onSuccess: async () => {
      setMessage('Abonnement activé.');
      await queryClient.invalidateQueries({ queryKey: ['platform-subscriptions'] });
      await queryClient.invalidateQueries({ queryKey: ['platform-module-subscriptions'] });
    },
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'active' | 'suspended' | 'cancelled' }) => {
      if (!window.confirm(`Confirmer le changement de statut vers « ${status} » ?`)) throw new Error('Action annulée.');
      return unwrap(await api.post<Subscription>(`/platform/subscriptions/update/${id}/status`, { status }));
    },
    onSuccess: async () => {
      setMessage('Statut d’abonnement mis à jour.');
      await queryClient.invalidateQueries({ queryKey: ['platform-subscriptions'] });
      await queryClient.invalidateQueries({ queryKey: ['platform-module-subscriptions'] });
    },
  });
  const setModuleStatus = useMutation({
    mutationFn: async ({ tenantId, moduleName, status }: { tenantId: number; moduleName: ModuleAccess['moduleName']; status: ModuleAccess['status'] }) => {
      const action = status === 'suspended' ? 'suspendre' : 'réactiver';
      if (!window.confirm(`Confirmer la volonté de ${action} le module ${moduleName} pour ce tenant ?`)) throw new Error('Action annulée.');
      return unwrap(await api.post('/platform/module-subscriptions/update', {
        tenant_id: tenantId,
        module_name: moduleName,
        status,
      }));
    },
    onSuccess: async () => {
      setMessage('Accès au module mis à jour.');
      await queryClient.invalidateQueries({ queryKey: ['platform-module-subscriptions'] });
    },
  });

  const submitConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');
    const values = new FormData(event.currentTarget);
    try {
      await updateConfig.mutateAsync({
        student_unit_price: String(values.get('student_unit_price') ?? ''),
        agent_unit_price: String(values.get('agent_unit_price') ?? ''),
        currency: String(values.get('currency') ?? '').toUpperCase(),
      });
    }
    catch (reason) { setError(getApiError(reason)); }
  };
  const handleGenerate = async () => {
    setMessage('');
    setError('');
    try { await generate.mutateAsync(); }
    catch (reason) { setError(getApiError(reason)); }
  };
  const handleCreateSubscription = async (tenantId: number) => {
    setMessage('');
    setError('');
    try { await createSubscription.mutateAsync(tenantId); }
    catch (reason) { setError(getApiError(reason)); }
  };
  const handleStatus = async (id: number, status: 'active' | 'suspended' | 'cancelled') => {
    setMessage('');
    setError('');
    try { await setStatus.mutateAsync({ id, status }); }
    catch (reason) {
      if (getApiError(reason) !== 'Action annulée.') setError(getApiError(reason));
    }
  };
  const handleModuleStatus = async (tenantId: number, moduleName: ModuleAccess['moduleName'], status: ModuleAccess['status']) => {
    setMessage('');
    setError('');
    try { await setModuleStatus.mutateAsync({ tenantId, moduleName, status }); }
    catch (reason) {
      if (getApiError(reason) !== 'Action annulée.') setError(getApiError(reason));
    }
  };

  const loading = config.isLoading || subscriptions.isLoading || moduleAccess.isLoading || invoices.isLoading || tenants.isLoading;
  const queryError = config.error ?? subscriptions.error ?? moduleAccess.error ?? invoices.error ?? tenants.error;

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">REVENUS DE LA PLATEFORME</span><h1>Abonnements SaaS</h1><p>Configurez les tarifs et suivez la facturation mensuelle des tenants.</p></div><span className="saas-mark"><BadgeDollarSign size={17} /> Facturation SaaS</span></section>
    <div className="notice"><FileClock size={17} /><span>Les factures enregistrées ici concernent l’accès à la plateforme SaaS. Elles sont distinctes des frais scolaires payés par les familles. Aucun paiement n’est marqué comme reçu dans ce module.</span></div>
    {message && <div className="success-notice" role="status"><CircleCheck size={17} />{message}</div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    {loading && <Loading />}
    {queryError && <ErrorState message={getApiError(queryError)} />}
    {!loading && !queryError && <div className="subscription-grid">
      <section className="panel pricing-panel"><div className="panel-heading"><div><span className="eyebrow">RÈGLES DE CALCUL</span><h2>Tarifs unitaires mensuels</h2></div><span className="panel-icon"><BadgeDollarSign size={19} /></span></div><p className="muted modal-description">Ces tarifs seront enregistrés dans le backend et copiés dans chaque facture lors de sa génération.</p>
        <form className="form-grid" key={config.data?.updatedAt} onSubmit={(event) => void submitConfig(event)}>
          <label className="field"><span>Prix par élève / mois</span><div className="input-with-suffix"><input name="student_unit_price" type="number" min="0" step="0.01" max="99999999.99" required defaultValue={config.data?.studentUnitPrice ?? '0.00'} /><b>{config.data?.currency ?? 'USD'}</b></div></label>
          <label className="field"><span>Prix par agent / mois</span><div className="input-with-suffix"><input name="agent_unit_price" type="number" min="0" step="0.01" max="99999999.99" required defaultValue={config.data?.agentUnitPrice ?? '0.00'} /><b>{config.data?.currency ?? 'USD'}</b></div></label>
          <label className="field field-full"><span>Devise (code ISO 4217)</span><input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" defaultValue={config.data?.currency ?? 'USD'} /></label>
          <button className="button button-primary field-full" type="submit" disabled={updateConfig.isPending}>{updateConfig.isPending ? 'Enregistrement…' : 'Enregistrer les tarifs'}</button>
        </form>
        <div className="pricing-footnote"><span className="bullet-check"><CircleCheck size={15} /></span><span>Le montant total est calculé côté serveur à partir des élèves, des agents actifs et de ces tarifs.</span></div>
      </section>
      <section className="panel generate-panel"><div className="panel-heading"><div><span className="eyebrow">CYCLE DE FACTURATION</span><h2>Générer les factures</h2></div><span className="panel-icon"><RefreshCw size={18} /></span></div><p className="muted modal-description">Une facture est créée une seule fois par tenant et par mois. Une nouvelle tentative ne duplique pas celles déjà émises.</p><label className="field"><span>Mois à traiter</span><input type="month" max={monthNow()} value={month} onChange={(event) => setMonth(event.target.value)} /></label><button className="button button-primary button-wide" disabled={generate.isPending || !month || month > monthNow()} onClick={() => void handleGenerate()}>{generate.isPending ? 'Calcul des factures…' : 'Calculer et enregistrer'}</button><p className="small muted scheduler-note">Pour une émission automatique à date fixe, planifiez l’appel protégé à l’API depuis un ordonnanceur serveur. La génération est idempotente.</p>
        <div className="eligible-tenants"><b>{availableTenants.length}</b><span>tenant(s) sans abonnement actif</span></div>
        {availableTenants.length > 0 && <div className="create-subscription-row"><select id="new-subscription-tenant" defaultValue=""><option value="" disabled>Choisir un tenant…</option>{availableTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select><button className="button button-secondary button-small" onClick={() => { const select = document.getElementById('new-subscription-tenant') as HTMLSelectElement | null; if (select?.value) void handleCreateSubscription(Number(select.value)); }} disabled={createSubscription.isPending}><Plus size={15} /> Activer</button></div>}
      </section>
    </div>}
    {!loading && !queryError && <section className="panel"><div className="table-toolbar"><div><h2>Abonnements des tenants</h2><span className="muted small">{subscriptions.data?.total ?? 0} contrats enregistrés</span></div></div>{subscriptions.data?.data.length ? <div className="table-scroll"><table><thead><tr><th>Tenant</th><th>Offre</th><th>Date de début</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{subscriptions.data.data.map((subscription) => <tr key={subscription.id}><td><div className="table-identity"><span className="table-avatar billing-avatar"><BadgeDollarSign size={16} /></span><span><b>{subscription.tenant.name}</b><small>Contrat #{subscription.id}</small></span></div></td><td>{subscription.plan || 'Tarification à l’usage'}</td><td>{subscription.startDate ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(subscription.startDate)) : '—'}</td><td><span className={`status-pill ${subscription.status === 'active' ? 'status-green' : subscription.status === 'suspended' ? 'status-orange' : 'status-gray'}`}><i />{subscription.status}</span></td><td className="action-cell">{subscription.status === 'active' ? <button className="button button-secondary button-small" onClick={() => void handleStatus(subscription.id, 'suspended')}><CirclePause size={14} /> Suspendre</button> : subscription.status === 'suspended' ? <button className="button button-secondary button-small" onClick={() => void handleStatus(subscription.id, 'active')}><CircleCheck size={14} /> Réactiver</button> : <span className="muted small">—</span>}</td></tr>)}</tbody></table></div> : <EmptyState message="Aucun abonnement n’est encore associé à un tenant." />}</section>}
    {!loading && !queryError && <section className="panel"><div className="table-toolbar"><div><h2>Accès aux modules</h2><span className="muted small">Tous les modules sont actifs par défaut avec un abonnement tenant actif. Vous pouvez suspendre ou réactiver un module individuellement.</span></div></div>{moduleAccess.data?.length ? <div className="table-scroll"><table><thead><tr><th>Tenant</th><th>Module</th><th>Accès</th><th>Origine</th><th>Action</th></tr></thead><tbody>{moduleAccess.data.map((access) => <tr key={`${access.tenantId}-${access.moduleName}`}><td><b>{access.tenantName}</b></td><td>{access.moduleName}</td><td><span className={`status-pill ${access.status === 'active' ? 'status-green' : 'status-orange'}`}><i />{access.status === 'active' ? 'Actif' : 'Suspendu / expiré'}</span></td><td>{access.inherited ? 'Inclus dans l’abonnement' : 'Contrôle manuel'}</td><td className="action-cell"><button className="button button-secondary button-small" onClick={() => void handleModuleStatus(access.tenantId, access.moduleName, access.status === 'active' ? 'suspended' : 'active')} disabled={setModuleStatus.isPending}>{access.status === 'active' ? <><CirclePause size={14} /> Suspendre</> : <><CircleCheck size={14} /> Réactiver</>}</button></td></tr>)}</tbody></table></div> : <EmptyState message="Aucun tenant n’a actuellement d’abonnement actif." />}</section>}
    {!loading && !queryError && <section className="panel"><div className="table-toolbar"><div><h2>Factures SaaS</h2><span className="muted small">Montants et volumes figés au moment de l’émission</span></div></div>{invoices.data?.data.length ? <div className="table-scroll"><table><thead><tr><th>Tenant</th><th>Période</th><th>Élèves</th><th>Agents actifs</th><th>Total calculé</th><th>État</th></tr></thead><tbody>{invoices.data.data.map((invoice) => <tr key={invoice.id}><td><b>{invoice.tenant.name}</b></td><td>{new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(invoice.periodStart))}</td><td>{invoice.studentCount} × {invoice.studentUnitPrice} {invoice.currency}</td><td>{invoice.agentCount} × {invoice.agentUnitPrice} {invoice.currency}</td><td><b>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: invoice.currency }).format(Number(invoice.totalAmount))}</b></td><td><span className={`status-pill ${invoice.status === 'pending' ? 'status-orange' : 'status-green'}`}><i />{invoice.status}</span></td></tr>)}</tbody></table></div> : <EmptyState message="Aucune facture SaaS générée. Configurez les tarifs puis lancez le premier cycle." />}</section>}
  </div>;
}
