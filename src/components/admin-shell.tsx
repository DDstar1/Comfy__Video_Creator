import type { ReactNode } from 'react';
import { BarChart3, MicVocal, ShieldCheck } from 'lucide-react';
import styles from './admin-shell.module.css';

export function AdminShell({ children, section }: { children: ReactNode; section: 'analytics' | 'voices' }) {
  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <a className={styles.brand} href="/admin"><ShieldCheck size={19} /> ClipWeave Admin</a>
      <nav aria-label="Administration">
        <a className={section === 'analytics' ? styles.active : ''} href="/admin"><BarChart3 size={17} /> Analytics</a>
        <a className={section === 'voices' ? styles.active : ''} href="/admin/voices"><MicVocal size={17} /> Voice library</a>
      </nav>
      <a className={styles.studio} href="/studio">← Back to Studio</a>
    </aside>
    <div className={styles.content}>{children}</div>
  </main>;
}
