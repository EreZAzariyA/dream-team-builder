import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth/config.js';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import DashboardSessionWrapper from '../../components/layouts/DashboardSessionWrapper';

export default async function DashboardLayoutWrapper({ children }) {
  // Fetch session on server-side for hydration
  const session = await getServerSession(authOptions);
  
  return (
    <DashboardSessionWrapper session={session}>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </DashboardSessionWrapper>
  );
}