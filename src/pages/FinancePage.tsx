import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, Building2, CircleDollarSign, FileClock, Wallet } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useSelectedTenant } from '../auth/TenantContext';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';
import { formatFinanceMoney } from '../lib/finance';
import { api, getApiError, unwrap } from '../lib/api';
import type { PageResult, School } from '../types';

type Amount = string | number;

interface FinanceStats {
  total_invoices: number;
  total_paid: Amount;
  total_outstanding: Amount;
  total_expenses: Amount;
  payment_methods: Array<{ payment_method: string; total: Amount }>;
  monthly_payments: Array<{ month: string; total: Amount }>;
}

interface PayrollStats {
  total_salary_paid: Amount;
  pending_payrolls: number;
}

interface OutstandingInvoice {
  id: number;
  total_due: Amount;
  student?: { firstName?: string; lastName?: string };
}

interface FinanceInvoice {
  id: number;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalAmount: Amount;
  paidAmount: Amount;
  student?: { firstName?: string; lastName?: string };
}

interface FinancePayment {
  id: number;
  amount: Amount;
  paymentDate: string;
  paymentMethod: string;
  reference: string | null;
  status: string;
  invoice?: { invoiceNumber: string; student?: { firstName?: string; lastName?: string } };
}

interface FinanceExpense {
  id: number;
  category: string;
  description: string;
  amount: Amount;
  expenseDate: string;
  paymentMethod: string;
  reference: string | null;
  school: Pick<School, 'id' | 'name'>;
}

interface FinanceStudent {
  id: number;
  firstName: string;
  lastName: string;
}

interface FinanceFeeCategory {
  id: number;
  name: string;
}

function lineSubtotal(amount: string, quantity: number): string {
  const [whole = '0', fraction = ''] = amount.split('.');
  const cents = (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * BigInt(quantity);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

function invoiceBalance(invoice: FinanceInvoice): number | null {
  const total = typeof invoice.totalAmount === 'number' || typeof invoice.totalAmount === 'string' ? Number(invoice.totalAmount) : Number.NaN;
  const paid = typeof invoice.paidAmount === 'number' || typeof invoice.paidAmount === 'string' ? Number(invoice.paidAmount) : Number.NaN;
  return Number.isFinite(total) && Number.isFinite(paid) ? Math.max(0, total - paid) : null;
}

const currentYear = new Date().getFullYear();
const asDateInputValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const money = (value: Amount) => formatFinanceMoney(value);

export function FinancePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const selectedTenantId = useSelectedTenant();
  const isSuperAdmin = user?.roles.includes('super_admin') ?? false;
  const isTenantAdmin = user?.roles.includes('tenant_admin') ?? false;
  const tenantId = user?.tenantId ?? selectedTenantId;
  const [schoolId, setSchoolId] = useState('');
  const [year, setYear] = useState(currentYear);
  const [paymentDate] = useState(() => asDateInputValue(new Date()));
  const [startDate, setStartDate] = useState(() => asDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [endDate, setEndDate] = useState(() => asDateInputValue(new Date()));
  const [reportTotal, setReportTotal] = useState<Amount | null>(null);
  const [reportError, setReportError] = useState('');
  const [paymentInvoice, setPaymentInvoice] = useState<FinanceInvoice | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const [refundError, setRefundError] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [newFeeCategoryName, setNewFeeCategoryName] = useState('');
  const [feeCategoryError, setFeeCategoryError] = useState('');
  const schoolList = useQuery({
    queryKey: ['finance', 'schools', tenantId],
    queryFn: async () => unwrap(await api.post<PageResult<School>>('/schools/list', { page: 1, per_page: 100 })),
    enabled: tenantId !== null,
  });
  const refundPayment = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => unwrap(await api.post<FinancePayment>(`/finance/payments/refund/${id}`, { reason })),
    onSuccess: async () => {
      setRefundError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] }),
        queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['finance', 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['finance', 'outstanding'] }),
      ]);
    },
  });
  const handleRefund = async (payment: FinancePayment) => {
    if (!window.confirm(`Confirmer le remboursement complet de ${money(payment.amount)} ?`)) return;
    const reason = window.prompt('Motif du remboursement (facultatif)');
    if (reason === null) return;
    setRefundError('');
    try { await refundPayment.mutateAsync({ id: payment.id, reason }); }
    catch (error) { setRefundError(getApiError(error)); }
  };
  const selectedSchool = schoolList.data?.data.find((school) => school.id === Number(schoolId)) ?? schoolList.data?.data[0];
  const activeSchoolId = selectedSchool?.id;
  const students = useQuery({
    queryKey: ['finance', 'students', tenantId, activeSchoolId],
    queryFn: async () => unwrap(await api.post<PageResult<FinanceStudent>>('/students/list/school', { school_id: activeSchoolId, page: 1, per_page: 100 })),
    enabled: tenantId !== null && activeSchoolId !== undefined && invoiceModalOpen,
  });
  const finance = useQuery({
    queryKey: ['finance', 'stats', tenantId, activeSchoolId],
    queryFn: async () => unwrap(await api.post<FinanceStats>('/stats/finance', { school_id: activeSchoolId })),
    enabled: tenantId !== null && activeSchoolId !== undefined,
  });
  const payroll = useQuery({
    queryKey: ['finance', 'payroll-stats', tenantId, activeSchoolId],
    queryFn: async () => unwrap(await api.post<PayrollStats>('/stats/payroll', { school_id: activeSchoolId })),
    enabled: tenantId !== null && activeSchoolId !== undefined,
  });
  const outstanding = useQuery({
    queryKey: ['finance', 'outstanding', tenantId, activeSchoolId],
    queryFn: async () => unwrap(await api.post<OutstandingInvoice[]>('/finance/reports/outstanding', { school_id: activeSchoolId })),
    enabled: tenantId !== null && activeSchoolId !== undefined,
  });
  const moduleUnavailable = outstanding.error !== null
    && getApiError(outstanding.error).toLowerCase().includes('module finance');
  const feeCategories = useQuery({
    queryKey: ['finance', 'fee-categories', tenantId],
    queryFn: async () => unwrap(await api.post<FinanceFeeCategory[]>('/finance/fee-categories/list', {})),
    enabled: tenantId !== null && activeSchoolId !== undefined && !moduleUnavailable,
  });
  const invoices = useQuery({
    queryKey: ['finance', 'invoices', tenantId, activeSchoolId],
    queryFn: async () => unwrap(await api.post<PageResult<FinanceInvoice>>('/finance/invoices/list', { school_id: activeSchoolId, page: 1, per_page: 25 })),
    enabled: tenantId !== null && activeSchoolId !== undefined && !outstanding.isLoading && !moduleUnavailable,
  });
  const payments = useQuery({
    queryKey: ['finance', 'payments', tenantId, activeSchoolId],
    queryFn: async () => unwrap(await api.post<PageResult<FinancePayment>>('/finance/payments/list', { school_id: activeSchoolId, page: 1, per_page: 25 })),
    enabled: tenantId !== null && activeSchoolId !== undefined && !outstanding.isLoading && !moduleUnavailable,
  });
  const expenses = useQuery({
    queryKey: ['finance', 'expenses', tenantId, activeSchoolId],
    queryFn: async () => unwrap(await api.post<PageResult<FinanceExpense>>('/finance/expenses/list', { school_id: activeSchoolId, page: 1, per_page: 25 })),
    enabled: tenantId !== null && activeSchoolId !== undefined && !outstanding.isLoading && !moduleUnavailable,
  });
  const canRegisterPayment = isSuperAdmin || isTenantAdmin || user?.permissions.includes('register-payment') === true;
  const canManageFinance = isSuperAdmin || isTenantAdmin || user?.permissions.includes('manage-finance') === true;
  const canCreateInvoice = canManageFinance && (isSuperAdmin || isTenantAdmin || user?.permissions.includes('create-invoice') === true);
  const canRefundPayment = isSuperAdmin || isTenantAdmin || user?.permissions.includes('refund-payment') === true;
  const createFeeCategory = useMutation({
    mutationFn: async (name: string) => unwrap(await api.post<FinanceFeeCategory>('/finance/fee-categories/create', { name })),
    onSuccess: async () => {
      setNewFeeCategoryName('');
      setFeeCategoryError('');
      await queryClient.invalidateQueries({ queryKey: ['finance', 'fee-categories'] });
    },
  });
  const createInvoice = useMutation({
    mutationFn: async (input: { student_id: number; fee_category_id: number; amount: string; quantity: number; issue_date: string; due_date: string }) => unwrap(await api.post<FinanceInvoice>('/finance/invoices/create', {
      student_id: input.student_id,
      issue_date: input.issue_date,
      due_date: input.due_date,
      items: [{
        fee_category_id: input.fee_category_id,
        description: feeCategories.data?.find((category) => category.id === input.fee_category_id)?.name ?? 'Frais scolaires',
        amount: input.amount,
        quantity: input.quantity,
        subtotal: lineSubtotal(input.amount, input.quantity),
      }],
    })),
    onSuccess: async () => {
      setInvoiceModalOpen(false);
      setInvoiceError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['finance', 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['finance', 'outstanding'] }),
      ]);
    },
  });
  const registerPayment = useMutation({
    mutationFn: async (values: { invoice_id: number; amount: string; payment_method: string; payment_date: string }) => unwrap(await api.post<FinancePayment>('/finance/payments/register', {
      ...values,
      payment_date: new Date(`${values.payment_date}T12:00:00`).toISOString(),
    })),
    onSuccess: async () => {
      setPaymentInvoice(null);
      setPaymentError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] }),
        queryClient.invalidateQueries({ queryKey: ['finance', 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['finance', 'outstanding'] }),
      ]);
    },
  });
  const createExpense = useMutation({
    mutationFn: async (values: { category: string; description: string; amount: string; expense_date: string; payment_method: string; reference: string; notes: string }) => {
      if (activeSchoolId === undefined) throw new Error('Sélectionnez une école avant d’enregistrer une dépense.');
      return unwrap(await api.post<FinanceExpense>('/finance/expenses/create', {
        ...values,
        school_id: activeSchoolId,
      }));
    },
    onSuccess: async () => {
      setExpenseError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['finance', 'stats'] }),
      ]);
    },
  });
  const paymentsReport = useMutation({
    mutationFn: async () => unwrap(await api.post<{ total: Amount }>('/finance/reports/payments-between', {
      school_id: activeSchoolId,
      start_date: startDate,
      end_date: endDate,
    })),
    onSuccess: (result) => {
      setReportTotal(result.total);
      setReportError('');
    },
    onError: (error) => {
      setReportTotal(null);
      setReportError(getApiError(error));
    },
  });
  const exportPayroll = useMutation({
    mutationFn: async () => {
      const response = await api.post<Blob>('/rapports/export-excel', { school_id: activeSchoolId, year }, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `salaires-${year}-ecole-${activeSchoolId}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    },
  });

  return <div className="page-stack">
    <section className="page-heading">
      <div><span className="eyebrow">GESTION FINANCIÈRE</span><h1>Finances scolaires</h1><p>Suivez les paiements des familles, les soldes dus et les indicateurs de paie.</p></div>
      <label className="finance-school-picker"><Building2 size={16} /><span className="sr-only">École</span><select aria-label="École financière" value={selectedSchool ? String(selectedSchool.id) : ''} onChange={(event) => { setSchoolId(event.target.value); setReportTotal(null); }} disabled={!schoolList.data?.data.length}><option value="">Choisir une école</option>{schoolList.data?.data.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
    </section>
    {isSuperAdmin && !selectedTenantId && <div className="notice"><Building2 size={17} /><span>Sélectionnez d’abord un tenant dans le menu supérieur pour consulter ses finances.</span>    </div>}
    {invoiceModalOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-invoice-heading"><div className="modal-heading"><div><span className="eyebrow">FACTURATION SCOLAIRE</span><h2 id="create-invoice-heading">Créer une facture</h2></div><button className="icon-button" type="button" onClick={() => setInvoiceModalOpen(false)} aria-label="Fermer">×</button></div>{students.isLoading || feeCategories.isLoading ? <Loading label="Chargement des élèves et catégories…" /> : students.error || feeCategories.error ? <ErrorState message={getApiError(students.error ?? feeCategories.error)} /> : <form className="form-grid" onSubmit={(event) => {
      event.preventDefault();
      setInvoiceError('');
      const values = new FormData(event.currentTarget);
      void createInvoice.mutateAsync({
        student_id: Number(values.get('student_id')),
        fee_category_id: Number(values.get('fee_category_id')),
        amount: String(values.get('amount') ?? ''),
        quantity: Number(values.get('quantity')),
        issue_date: String(values.get('issue_date') ?? ''),
        due_date: String(values.get('due_date') ?? ''),
      }).catch((error: unknown) => setInvoiceError(getApiError(error)));
    }}>
      <label className="field field-full"><span>Élève</span><select name="student_id" required defaultValue=""><option value="" disabled>Choisir un élève…</option>{students.data?.data.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select></label>
      <label className="field field-full"><span>Catégorie de frais</span><select name="fee_category_id" required defaultValue=""><option value="" disabled>Choisir une catégorie…</option>{feeCategories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="field"><span>Montant unitaire (USD)</span><input name="amount" type="number" min="0" step="0.01" max="99999999.99" required /></label>
      <label className="field"><span>Quantité</span><input name="quantity" type="number" min="1" max="1000000" step="1" defaultValue="1" required /></label>
      <label className="field"><span>Date d’émission</span><input name="issue_date" type="date" defaultValue={paymentDate} required /></label>
      <label className="field"><span>Date d’échéance</span><input name="due_date" type="date" defaultValue={paymentDate} min={paymentDate} required /></label>
      {invoiceError && <div className="form-error field-full" role="alert">{invoiceError}</div>}
      {!students.data?.data.length && <div className="form-error field-full" role="alert">Aucun élève n’est enregistré dans cette école.</div>}
      {!feeCategories.data?.length && <div className="form-error field-full" role="alert">Créez d’abord une catégorie de frais avant d’émettre une facture.</div>}
      <div className="modal-actions field-full"><button className="button button-secondary" type="button" onClick={() => setInvoiceModalOpen(false)}>Annuler</button><button className="button button-primary" type="submit" disabled={createInvoice.isPending || !students.data?.data.length || !feeCategories.data?.length}>{createInvoice.isPending ? 'Création…' : 'Créer la facture'}</button></div>
    </form>}</section></div>}
    {paymentInvoice && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="register-payment-heading"><div className="modal-heading"><div><span className="eyebrow">ENCAISSEMENT SCOLAIRE</span><h2 id="register-payment-heading">Enregistrer un paiement</h2></div><button className="icon-button" type="button" onClick={() => setPaymentInvoice(null)} aria-label="Fermer">×</button></div><p className="muted modal-description">{paymentInvoice.invoiceNumber} · {paymentInvoice.student ? `${paymentInvoice.student.firstName ?? ''} ${paymentInvoice.student.lastName ?? ''}`.trim() : 'Élève'} · Solde dû : <b>{invoiceBalance(paymentInvoice) === null ? '—' : money(invoiceBalance(paymentInvoice) ?? 0)}</b></p><form className="form-grid" onSubmit={(event) => { event.preventDefault(); setPaymentError(''); const values = new FormData(event.currentTarget); void registerPayment.mutateAsync({ invoice_id: paymentInvoice.id, amount: String(values.get('amount') ?? ''), payment_method: String(values.get('payment_method') ?? ''), payment_date: String(values.get('payment_date') ?? '') }).catch((error: unknown) => setPaymentError(getApiError(error))); }}><label className="field"><span>Montant reçu</span><input name="amount" type="number" min="0.01" max={invoiceBalance(paymentInvoice) ?? undefined} step="0.01" required disabled={invoiceBalance(paymentInvoice) === null} /></label><label className="field"><span>Mode de paiement</span><select name="payment_method" required defaultValue="cash"><option value="cash">Espèces</option><option value="bank_transfer">Virement bancaire</option><option value="mobile_money">Mobile money</option><option value="cheque">Chèque</option><option value="card">Carte</option></select></label><label className="field field-full"><span>Date du paiement</span><input name="payment_date" type="date" required defaultValue={paymentDate} /></label>{paymentError && <div className="form-error field-full" role="alert">{paymentError}</div>}<div className="modal-actions field-full"><button className="button button-secondary" type="button" onClick={() => setPaymentInvoice(null)}>Annuler</button><button className="button button-primary" type="submit" disabled={registerPayment.isPending || invoiceBalance(paymentInvoice) === null}>{registerPayment.isPending ? 'Enregistrement…' : 'Confirmer le paiement'}</button></div></form></section></div>}
    {schoolList.isLoading && tenantId !== null && <Loading label="Chargement des écoles…" />}
    {schoolList.error && <ErrorState message={getApiError(schoolList.error)} />}
    {schoolList.data && tenantId !== null && schoolList.data.data.length === 0 && <EmptyState message="Aucune école n’est disponible dans ce tenant." />}
    {selectedSchool && <>
      <div className="notice"><FileClock size={17} /><span>Ces indicateurs couvrent l’école « {selectedSchool.name} ». Les revenus scolaires sont séparés de la facturation des abonnements SaaS.</span></div>
      {finance.isLoading && <Loading label="Chargement des indicateurs financiers…" />}
      {finance.error && <ErrorState message={getApiError(finance.error)} />}
      {finance.data && <section className="stats-grid">
        <Metric icon={<CircleDollarSign size={19} />} label="Paiements enregistrés" value={money(finance.data.total_paid)} accent="green" />
        <Metric icon={<Wallet size={19} />} label="Reste à recouvrer" value={money(finance.data.total_outstanding)} accent="orange" />
        <Metric icon={<Wallet size={19} />} label="Dépenses enregistrées" value={money(finance.data.total_expenses)} accent="violet" />
        <Metric icon={<FileClock size={19} />} label="Factures scolaires" value={finance.data.total_invoices} accent="blue" />
        <Metric icon={<Wallet size={19} />} label="Salaires versés" value={payroll.data ? money(payroll.data.total_salary_paid) : payroll.isLoading ? '…' : 'Indisponible'} accent="violet" />
      </section>}
      {moduleUnavailable && <div className="notice finance-module-notice" role="status"><FileClock size={18} /><span><b>Module Finance inactif.</b> L’abonnement Finance de ce tenant est absent ou expiré. Les rapports détaillés, factures et paiements sont indisponibles jusqu’à sa réactivation par le super-administrateur.</span></div>}
      {!moduleUnavailable && <div className="dashboard-grid finance-details-grid">
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">ENCAISSEMENTS</span><h2>Paiements par mois</h2></div><span className="panel-icon"><CircleDollarSign size={19} /></span></div>
          {finance.error && <p className="muted small">Le rapport mensuel n’est pas disponible.</p>}
          {finance.data?.monthly_payments.length ? <div className="table-scroll"><table><thead><tr><th>Mois</th><th>Total reçu</th></tr></thead><tbody>{finance.data.monthly_payments.map((item) => <tr key={item.month}><td>{new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.month}-01T00:00:00Z`))}</td><td><b>{money(item.total)}</b></td></tr>)}</tbody></table></div> : !finance.isLoading && !finance.error && <EmptyState message="Aucun paiement enregistré pour cette école." />}
          {finance.data?.payment_methods.length ? <div className="finance-methods"><h3>Répartition par mode de paiement</h3>{finance.data.payment_methods.map((item) => <div className="activity-line" key={item.payment_method}><span>{item.payment_method.replaceAll('_', ' ')}</span><b>{money(item.total)}</b></div>)}</div> : null}
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">SUIVI DES SOLDES</span><h2>Factures avec solde dû</h2></div><span className="count-badge">{outstanding.data?.length ?? '—'}</span></div>
          {outstanding.isLoading && <Loading label="Chargement des soldes…" />}
          {outstanding.error && <ErrorState message={getApiError(outstanding.error)} />}
          {outstanding.data && (outstanding.data.length ? <div className="table-scroll"><table><thead><tr><th>Facture</th><th>Élève</th><th>Solde</th></tr></thead><tbody>{outstanding.data.slice(0, 20).map((invoice) => <tr key={invoice.id}><td>#{invoice.id}</td><td>{invoice.student ? `${invoice.student.firstName ?? ''} ${invoice.student.lastName ?? ''}`.trim() || '—' : '—'}</td><td><b>{money(invoice.total_due)}</b></td></tr>)}</tbody></table>{outstanding.data.length > 20 && <p className="muted small">Affichage des 20 premiers soldes sur {outstanding.data.length}.</p>}</div> : <EmptyState message="Aucune facture avec solde restant." />)}
        </section>
      </div>}
      {!moduleUnavailable && <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">FACTURATION SCOLAIRE</span><h2>Factures récentes</h2><p className="muted small">{invoices.data?.total ?? '—'} facture(s) enregistrée(s)</p></div><div className="panel-actions"><span className="panel-icon"><FileClock size={19} /></span>{canCreateInvoice && <button className="button button-primary button-small" type="button" onClick={() => setInvoiceModalOpen(true)}>Créer une facture</button>}</div></div>
        {canManageFinance && <form className="finance-report-form" onSubmit={(event) => {
          event.preventDefault();
          setFeeCategoryError('');
          void createFeeCategory.mutateAsync(newFeeCategoryName).catch((error: unknown) => setFeeCategoryError(getApiError(error)));
        }}>
          <label className="field"><span>Nouvelle catégorie de frais</span><input required maxLength={191} value={newFeeCategoryName} onChange={(event) => setNewFeeCategoryName(event.target.value)} placeholder="Ex. Frais de scolarité" /></label>
          <button className="button button-secondary" type="submit" disabled={createFeeCategory.isPending || !newFeeCategoryName.trim()}>{createFeeCategory.isPending ? 'Ajout…' : 'Ajouter la catégorie'}</button>
          {feeCategoryError && <div className="form-error field-full" role="alert">{feeCategoryError}</div>}
        </form>}
        {invoices.isLoading && <Loading label="Chargement des factures…" />}
        {invoices.error && <ErrorState message={getApiError(invoices.error)} />}
        {invoices.data && (invoices.data.data.length ? <div className="table-scroll"><table><thead><tr><th>Référence</th><th>Élève</th><th>Échéance</th><th>Montant</th><th>Statut</th><th>Action</th></tr></thead><tbody>{invoices.data.data.map((invoice) => {
          const balance = invoiceBalance(invoice);
          return <tr key={invoice.id}><td><b>{invoice.invoiceNumber}</b></td><td>{invoice.student ? `${invoice.student.firstName ?? ''} ${invoice.student.lastName ?? ''}`.trim() || '—' : '—'}</td><td>{new Intl.DateTimeFormat('fr-FR').format(new Date(invoice.dueDate))}</td><td>{money(invoice.totalAmount)}</td><td><span className={`status-pill ${invoice.status === 'paid' ? 'status-green' : invoice.status === 'draft' ? 'status-gray' : 'status-orange'}`}><i />{invoice.status}</span></td><td>{balance !== null && balance > 0 && canRegisterPayment ? <button className="button button-secondary button-small" type="button" onClick={() => { setPaymentInvoice(invoice); setPaymentError(''); }}>Enregistrer paiement</button> : balance !== null && balance > 0 ? <span className="muted small">Permission requise</span> : balance === null ? '—' : '—'}</td></tr>;
        })}</tbody></table></div> : <EmptyState message="Aucune facture scolaire enregistrée." />)}
      </section>}
      {!moduleUnavailable && <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">DÉPENSES SCOLAIRES</span><h2>Charges récentes</h2><p className="muted small">{expenses.data?.total ?? '—'} dépense(s) enregistrée(s)</p></div><span className="panel-icon"><Wallet size={19} /></span></div>
        {canManageFinance && <form className="finance-report-form" onSubmit={(event) => {
          event.preventDefault();
          setExpenseError('');
          const form = event.currentTarget;
          const values = new FormData(form);
          void createExpense.mutateAsync({
            category: String(values.get('category') ?? ''),
            description: String(values.get('description') ?? ''),
            amount: String(values.get('amount') ?? ''),
            expense_date: String(values.get('expense_date') ?? ''),
            payment_method: String(values.get('payment_method') ?? ''),
            reference: String(values.get('reference') ?? ''),
            notes: String(values.get('notes') ?? ''),
          }).then(() => form.reset()).catch((error: unknown) => setExpenseError(getApiError(error)));
        }}>
          <label className="field"><span>Catégorie</span><input name="category" required maxLength={191} placeholder="Ex. Fournitures" /></label>
          <label className="field"><span>Description</span><input name="description" required maxLength={191} /></label>
          <label className="field"><span>Montant</span><input name="amount" type="number" min="0.01" max="99999999.99" step="0.01" required /></label>
          <label className="field"><span>Date</span><input name="expense_date" type="date" required defaultValue={paymentDate} /></label>
          <label className="field"><span>Mode de paiement</span><select name="payment_method" defaultValue="cash"><option value="cash">Espèces</option><option value="bank_transfer">Virement bancaire</option><option value="mobile_money">Mobile money</option><option value="cheque">Chèque</option><option value="card">Carte</option></select></label>
          <label className="field"><span>Référence</span><input name="reference" maxLength={255} /></label>
          <button className="button button-primary" type="submit" disabled={createExpense.isPending}>{createExpense.isPending ? 'Enregistrement…' : 'Enregistrer la dépense'}</button>
          {expenseError && <div className="form-error field-full" role="alert">{expenseError}</div>}
        </form>}
        {expenses.isLoading && <Loading label="Chargement des dépenses…" />}
        {expenses.error && <ErrorState message={getApiError(expenses.error)} />}
        {expenses.data && (expenses.data.data.length ? <div className="table-scroll"><table><thead><tr><th>Date</th><th>Catégorie</th><th>Description</th><th>Mode</th><th>Référence</th><th>Montant</th></tr></thead><tbody>{expenses.data.data.map((expense) => <tr key={expense.id}><td>{new Intl.DateTimeFormat('fr-FR').format(new Date(expense.expenseDate))}</td><td>{expense.category}</td><td>{expense.description}</td><td>{expense.paymentMethod.replaceAll('_', ' ')}</td><td>{expense.reference || '—'}</td><td><b>{money(expense.amount)}</b></td></tr>)}</tbody></table></div> : <EmptyState message="Aucune dépense enregistrée pour cette école." />)}
      </section>}
      {!moduleUnavailable && <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">ENCAISSEMENTS</span><h2>Paiements récents</h2><p className="muted small">{payments.data?.total ?? '—'} paiement(s) enregistré(s)</p></div><span className="panel-icon"><CircleDollarSign size={19} /></span></div>
        {refundError && <ErrorState message={refundError} />}
        {payments.isLoading && <Loading label="Chargement des paiements…" />}
        {payments.error && <ErrorState message={getApiError(payments.error)} />}
        {payments.data && (payments.data.data.length ? <div className="table-scroll"><table><thead><tr><th>Date</th><th>Référence facture</th><th>Élève</th><th>Mode</th><th>Référence paiement</th><th>Montant</th><th>Action</th></tr></thead><tbody>{payments.data.data.map((payment) => <tr key={payment.id}><td>{new Intl.DateTimeFormat('fr-FR').format(new Date(payment.paymentDate))}</td><td>{payment.invoice?.invoiceNumber ?? '—'}</td><td>{payment.invoice?.student ? `${payment.invoice.student.firstName ?? ''} ${payment.invoice.student.lastName ?? ''}`.trim() || '—' : '—'}</td><td>{payment.paymentMethod.replaceAll('_', ' ')}</td><td>{payment.reference || '—'}</td><td><b>{money(payment.amount)}</b></td><td>{canRefundPayment && payment.status === 'completed' && Number(payment.amount) > 0 ? <button className="button button-secondary button-small" type="button" onClick={() => void handleRefund(payment)} disabled={refundPayment.isPending}>Rembourser</button> : '—'}</td></tr>)}</tbody></table></div> : <EmptyState message="Aucun paiement enregistré pour cette école." />)}
      </section>}
      {!moduleUnavailable && <div className="dashboard-grid finance-details-grid">
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">RAPPORT DE PAIEMENTS</span><h2>Encaissements sur une période</h2></div><span className="panel-icon"><FileClock size={19} /></span></div>
          <form className="finance-report-form" onSubmit={(event) => { event.preventDefault(); void paymentsReport.mutateAsync(); }}>
            <label className="field"><span>Du</span><input type="date" required value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label className="field"><span>Au</span><input type="date" required value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
            <button className="button button-primary" type="submit" disabled={paymentsReport.isPending || outstanding.isLoading}>{paymentsReport.isPending ? 'Calcul…' : 'Calculer'}</button>
          </form>
          {reportError && <ErrorState message={reportError} />}
          {reportTotal !== null && <p className="finance-report-total" role="status">Total reçu sur la période : <b>{money(reportTotal)}</b></p>}
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">EXPORT DE PAIE</span><h2>Rapport annuel</h2></div><span className="panel-icon"><ArrowDownToLine size={19} /></span></div>
          <p className="muted modal-description">Téléchargez le récapitulatif annuel des salaires au format CSV, compatible avec Excel.</p>
          <div className="finance-export-row"><label className="field"><span>Année</span><input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label><button className="button button-secondary" type="button" disabled={exportPayroll.isPending || activeSchoolId === undefined || year < 2000 || year > 2100 || outstanding.isLoading} onClick={() => exportPayroll.mutate()}><ArrowDownToLine size={16} />{exportPayroll.isPending ? 'Préparation…' : 'Exporter le CSV'}</button></div>
          {payroll.error && <p className="muted small">Indicateurs de paie : {getApiError(payroll.error)}</p>}
          {payroll.data && <p className="muted small">{payroll.data.pending_payrolls} élément(s) de paie en attente.</p>}
          {exportPayroll.error && <ErrorState message={getApiError(exportPayroll.error)} />}
        </section>
      </div>}
    </>}
  </div>;
}

function Metric({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string | number; accent: string }) {
  return <article className="stat-card"><div className={`stat-card-icon icon-${accent}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">École sélectionnée</span></article>;
}
