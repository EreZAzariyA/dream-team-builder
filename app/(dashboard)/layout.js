import DashboardLayout from '../../components/layouts/DashboardLayout';

export default function DashboardLayoutWrapper({ children }) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}