'use client';

import { useEffect, useState } from 'react';

const groups = ['Owners', 'Management', 'High Staff', 'Staffs'] as const;

type StaffMember = {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  rank: string;
  group: string;
};

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/staff', { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Unable to load staff');
        return data;
      })
      .then((data) => setStaff(data.staff || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="section">
      <div className="container">
        <div className="staff-head">
          <div>
            <h1 className="title">Staff Team</h1>
            <p className="lead">Staff ranks are grouped by hierarchy and synced from live Discord roles.</p>
          </div>
          <a className="btn btn-red" href="/api/auth/discord">Sign in with Discord</a>
        </div>

        {loading && <div className="notice">Loading Discord staff...</div>}
        {error && <div className="notice">Discord staff could not be loaded: {error}</div>}
        {!loading && !error && staff.length === 0 && (
          <div className="notice">No staff member with the configured Discord roles was found.</div>
        )}

        {groups.map((group) => {
          const members = staff.filter((member) => member.group === group);
          return (
            <div key={group} className="staff-group">
              <h2>{group}</h2>
              <div className="grid">
                {members.map((member) => (
                  <div className="card staff-card" key={`${member.id}-${member.rank}`}>
                    <img className="staff-avatar" src={member.avatar} alt="" />
                    <div className="staff-info">
                      <h3>{member.displayName}</h3>
                      <p>@{member.username}</p>
                      <span className="staff-rank">{member.rank}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
