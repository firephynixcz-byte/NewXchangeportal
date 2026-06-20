'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCustomerSession } from '@/app/actions/auth-actions';

const FormWizardPage = dynamic(() => import('./FormWizardPage'), {
  ssr: false,
  loading: () => <div>กำลังโหลดฟอร์ม...</div>
});

export default function Page() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const s = await getCustomerSession();
      if (!s) {
        router.push('/login');
      } else {
        setSession(s);
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  if (loading) return <div>กำลังตรวจสอบสิทธิ์...</div>;

  return <FormWizardPage session={session} />;
}