
import ActiveProjectsEnhanced from '../../../../components/dashboard/ActiveProjectsEnhanced';

export default function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Active Projects</h2>
          <ActiveProjectsEnhanced />
        </div>
      </div>
    </div>
  );
}
