import { AlertCircle, LoaderCircle } from 'lucide-react';

export function Loading({ label = 'Chargement des données…' }: { label?: string }) {
  return <div className="feedback"><LoaderCircle size={20} className="spin" /><span>{label}</span></div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="feedback feedback-error"><AlertCircle size={20} /><span>{message}</span></div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}
