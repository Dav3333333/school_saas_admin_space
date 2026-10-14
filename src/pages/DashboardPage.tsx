import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ArrowUpRight, Building2, CircleDollarSign, GraduationCap, Users, WalletCards } from 'lucide-react';
import { api, unwrap } from '../lib/api';
import { formatFinanceMoney } from '../lib/finance';
import { useAuth } from '../auth/AuthContext';
import { ErrorState, Loading } from '../components/Feedback';
import type { PageResult, School, Tenant } from '../types';

interface SystemStats {
  generated_at: string;
  tenants: { total: number; schools: number; active_subscriptions: number; active_module_subscriptions: number };
  users: { total: number; active: number; active_sessions: number };
  education: { students: number; enrollments: number; teachers: number; courses: number; grade_entries: number };
  finance: { invoices: number; total_invoiced: string; invoice_paid: string; outstanding: string; completed_payments: string; total_expenses: string };
  activity: { total_audit_events: number; audit_events_last_24_hours: number; failed_login_attempts_last_24_hours: number };
}

const money = (value: string, currency = 'USD') => formatFinanceMoney(value, currency);
const todayLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date());

export function DashboardPage() {
  const { user } = useAuth();
  const global = user?.roles.includes('super_admin') ?? false;
  const stats = useQuery({
    queryKey: ['dashboard', 'system'],
    queryFn: async () => unwrap(await api.post<SystemStats>('/stats/system', {})),
    enabled: global,
  });
  const schools = useQuery({
    queryKey: ['dashboard', 'schools', user?.tenantId],
    queryFn: async () => unwrap(await api.post<PageResult<School>>(global ? '/schools/all' : '/schools/list', { page: 1, per_page: 100 })),
    enabled: !global,
  });
  const tenantStudents = useQuery({
    queryKey: ['dashboard', 'students', user?.tenantId],
    queryFn: async () => unwrap(await api.post<PageResult<unknown>>('/students/list', { page: 1, per_page: 1 })),
    enabled: !global,
  });
  const tenantAgents = useQuery({
    queryKey: ['dashboard', 'agents', user?.tenantId],
    queryFn: async () => unwrap(await api.post<PageResult<unknown>>('/agents', { page: 1, per_page: 1 })),
    enabled: !global,
  });
  const tenants = useQuery({
    queryKey: ['dashboard', 'tenants'],
    queryFn: async () => unwrap(await api.post<PageResult<Tenant>>('/tenants/list', { page: 1, per_page: 100 })),
    enabled: global,
  });
  const isLoading = global ? stats.isLoading : schools.isLoading || tenantStudents.isLoading || tenantAgents.isLoading;
  const error = global ? stats.error ?? tenants.error : schools.error ?? tenantStudents.error ?? tenantAgents.error;
  const data = stats.data;

  return <div className="page-stack">
    <section className="page-heading"><div><span className="eyebrow">TABLEAU DE BORD</span><h1>Bonjour, {user?.name.split(' ')[0]} <span className="wave">👋</span></h1><p>{global ? 'Voici la vue d’ensemble de votre plateforme.' : 'Retrouvez ici les repères de votre espace tenant.'}</p></div><div className="heading-date">{todayLabel}</div></section>
    {isLoading && <Loading />}
    {error && <ErrorState message="Les indicateurs n’ont pas pu être chargés depuis l’API." />}
    {!isLoading && !error && global && data && <><section className="stats-grid">
      <StatCard icon={<Building2 size={19} />} label="Tenants" value={data.tenants.total} note={`${data.tenants.schools} écoles`} accent="blue" />
      <StatCard icon={<GraduationCap size={19} />} label="Élèves" value={data.education.students} note={`${data.education.enrollments} inscriptions`} accent="violet" />
      <StatCard icon={<Users size={19} />} label="Comptes utilisateurs" value={data.users.active} note={`${data.users.active_sessions} sessions actives`} accent="green" />
      <StatCard icon={<WalletCards size={19} />} label="Abonnements actifs" value={data.tenants.active_subscriptions} note={`${data.tenants.active_module_subscriptions} modules actifs`} accent="orange" />
    </section><section className="dashboard-grid">
      <article className="panel finance-panel"><div className="panel-heading"><div><span className="eyebrow">FINANCES SCOLAIRES</span><h2>Activité financière des écoles</h2></div><span className="panel-icon"><CircleDollarSign size={20} /></span></div><p className="finance-caption">Ces montants concernent la facturation scolaire (parents/élèves), pas les abonnements SaaS.</p><div className="finance-summary"><div><span>Montant facturé</span><strong>{money(data.finance.total_invoiced)}</strong></div><div><span>Paiements enregistrés</span><strong>{money(data.finance.completed_payments)}</strong></div></div><div className="finance-footer"><span>{data.finance.invoices} factures scolaires · Dépenses : {money(data.finance.total_expenses)}</span><span className="link-inline">Données API <ArrowUpRight size={14} /></span></div></article>
      <article className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">SÉCURITÉ</span><h2>Activité récente</h2></div><span className="status-pill status-green"><i /> Système actif</span></div><div className="activity-list"><ActivityLine label="Événements d’audit" value={data.activity.total_audit_events} /><ActivityLine label="Activité · dernières 24 h" value={data.activity.audit_events_last_24_hours} /><ActivityLine label="Échecs de connexion · 24 h" value={data.activity.failed_login_attempts_last_24_hours} warning={data.activity.failed_login_attempts_last_24_hours > 0} /></div><p className="updated-at">Données actualisées à {new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(new Date(data.generated_at))}</p></article>
    </section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">RÉSEAU</span><h2>Tenants de la plateforme</h2></div><span className="count-badge">{tenants.data?.total ?? 0} au total</span></div><div className="compact-tenants">{tenants.data?.data.slice(0, 5).map((tenant) => <div className="compact-tenant" key={tenant.id}><span className="tenant-avatar">{tenant.name.slice(0, 1).toUpperCase()}</span><span><b>{tenant.name}</b><small>{tenant.domain || 'Domaine non défini'}</small></span><ArrowUpRight size={15} /></div>)}</div></section></>}
    {!isLoading && !error && !global && <section className="stats-grid"><StatCard icon={<Building2 size={19} />} label="Écoles accessibles" value={schools.data?.total ?? 0} note="Selon les droits de votre tenant" accent="blue" /><StatCard icon={<Users size={19} />} label="Équipe scolaire" value={tenantAgents.data?.total ?? 0} note="Profils présents dans votre tenant" accent="green" /><StatCard icon={<GraduationCap size={19} />} label="Élèves" value={tenantStudents.data?.total ?? 0} note="Profils présents dans votre tenant" accent="violet" /><StatCard icon={<WalletCards size={19} />} label="Abonnement SaaS" value="—" note="Lecture réservée au super administrateur" accent="orange" /></section>}
  </div>;
}

function StatCard({ icon, label, value, note, accent }: { icon: ReactNode; label: string; value: string | number; note: string; accent: string }) {
  return <article className="stat-card"><div className={`stat-card-icon icon-${accent}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></article>;
}

function ActivityLine({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className="activity-line"><span><i className={warning ? 'activity-alert' : ''} />{label}</span><b>{value}</b></div>;
}
