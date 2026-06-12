import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function RootPage() {
    const session = await getSession();
    
    if (!session) {
        redirect('/login');
    }
    
    if (session.role === 'admin') {
        if (session.must_change_password === 1) {
            redirect('/admin/change-password');
        }
        redirect('/admin');
    } else {
        redirect('/dashboard');
    }
}
