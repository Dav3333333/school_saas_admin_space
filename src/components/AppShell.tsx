import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, BadgeDollarSign, BookOpen, Building2, ChevronDown, CircleDollarSign, GraduationCap, LayoutDashboard, LogOut, Menu, Users, X } from 'lucide-react';
import { api, setSelectedTenant, unwrap } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { TenantContext } from '../auth/TenantContext';
import type { PageResult, Tenant } from '../types';

const globalLinks = [
  { to: '/dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { to: '/finance', label: 'Finances scolaires', icon: CircleDollarSign },
  { to: '/tenants', label: 'Tenants', icon: Building2 },
  { to: '/schools', label: 'Écoles', icon: GraduationCap },
  { to: '/agents', label: 'Agents', icon: Users },
  { to: '/students', label: 'Élèves', icon: BookOpen },
  { to: '/subscriptions', label: 'Abonnements', icon: BadgeDollarSign },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const isSuperAdmin = user?.roles.includes('super_admin') ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const [tenantId, setTenantId] = useState<number | null>(() => {
    if (!isSuperAdmin) return user?.tenantId ?? null;
    const stored = sessionStorage.getItem('school-admin.tenant-id');
    return stored && /^\d+$/.test(stored) ? Number(stored) : null;
  });
  const tenants = useQuery({
    queryKey: ['tenants', 'selector'],
    queryFn: async () => unwrap(await api.post<PageResult<Tenant>>('/tenants/list', { page: 1, per_page: 100 })),
    enabled: isSuperAdmin,
  });

  useEffect(() => setSelectedTenant(tenantId), [tenantId]);

  const changeTenant = (value: string) => {
    const nextId = value ? Number(value) : null;
    setTenantId(nextId);
    setSelectedTenant(nextId);
    if (nextId === null) sessionStorage.removeItem('school-admin.tenant-id');
    else sessionStorage.setItem('school-admin.tenant-id', String(nextId));
  };

  const links = isSuperAdmin ? globalLinks : globalLinks.filter(({ to }) => to === '/dashboard' || to === '/finance' || to === '/schools' || to === '/agents' || to === '/students');

  return (
    <TenantContext.Provider value={tenantId}>
      <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><GraduationCap size={22} /></span><span>École<span className="brand-light">Pilot</span></span><button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><X size={18} /></button></div>
        <div className="workspace-label">ESPACE ADMINISTRATION</div>
        <nav className="side-nav">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{to === '/subscriptions' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="secure-note"><Activity size={16} /><span>Accès sécurisé<br /><b>API connectée</b></span></div></div>
      </aside>

      {menuOpen && <button className="mobile-scrim" aria-label="Fermer la navigation" onClick={() => setMenuOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Administration</span><span className="breadcrumb-divider">/</span><b>{links.find((link) => location.pathname.startsWith(link.to))?.label ?? 'Portail'}</b></div>
          <div className="topbar-actions">
            {isSuperAdmin && <label className="tenant-picker"><Building2 size={16} /><select aria-label="Tenant actif" value={tenantId ?? ''} onChange={(event) => changeTenant(event.target.value)}><option value="">Tous les tenants</option>{tenants.data?.data.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select><ChevronDown size={14} /></label>}
            <div className="user-pill"><div className="avatar">{user?.name.slice(0, 1).toUpperCase()}</div><div className="user-meta"><b>{user?.name}</b><span>{isSuperAdmin ? 'Super administrateur' : 'Administrateur tenant'}</span></div></div>
            <button className="icon-button logout-button" title="Se déconnecter" aria-label="Se déconnecter" onClick={() => void signOut()}><LogOut size={17} /></button>
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
      </div>
    </TenantContext.Provider>
  );
}
