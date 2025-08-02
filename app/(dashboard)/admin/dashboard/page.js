
import ActiveWorkflows from '../../../../components/dashboard/ActiveWorkflows';

export default function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboardddddd</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActiveWorkflows />
      </div>
    </div>
  );
}
