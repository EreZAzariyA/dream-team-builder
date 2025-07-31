
import Link from 'next/link';

export default function AdminPage() {
  return (
    <div>
      <h2>Welcome to the Admin Panel</h2>
      <p>Please select a section to manage:</p>
      <ul>
        <li>
          <Link href="/admin/dashboard">
            <a>Dashboard</a>
          </Link>
        </li>
      </ul>
    </div>
  );
}
