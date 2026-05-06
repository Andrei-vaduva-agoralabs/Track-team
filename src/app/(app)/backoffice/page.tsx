import { prisma } from "@/lib/prisma";
import { ensureAdminUser } from "@/lib/email-code-auth";
import { requireAdmin } from "@/lib/access";
import {
  addWhitelistUserAction,
  setWhitelistUserStatusAction
} from "@/app/backoffice/actions";

export const dynamic = "force-dynamic";

export default async function BackofficePage() {
  await requireAdmin();
  await ensureAdminUser();

  const users = await prisma.authUser.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }]
  });

  return (
    <div className="page-grid">
      <section className="hero panel">
        <div className="hero-copy-block">
          <p className="eyebrow">Backoffice</p>
          <h2>Access whitelist</h2>
          <p className="hero-copy">
            Only active emails listed here can request a login code. Admin users can
            access setup, capacity save actions, and this backoffice.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <p className="eyebrow">Invite user</p>
          <h2>Add a whitelisted email</h2>
        </div>
        <form action={addWhitelistUserAction} className="capacity-settings-grid">
          <label>
            Email
            <input name="email" type="email" placeholder="name@agoralabs.tech" required />
          </label>
          <label>
            Role
            <select name="role" defaultValue="viewer">
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <div className="action-row">
            <button type="submit">Add email</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header panel-header-inline">
          <div>
            <p className="eyebrow">Users</p>
            <h2>Whitelisted accounts</h2>
          </div>
          <p className="panel-meta">{users.length} total</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <span className={`status-pill ${user.active ? "available" : "warning"}`}>
                      {user.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>{user.lastLoginAt ? user.lastLoginAt.toLocaleString() : "Never"}</td>
                  <td>
                    {user.email === "andrei.vaduva@agoralabs.tech" ? (
                      <span className="panel-meta">Owner</span>
                    ) : (
                      <form action={setWhitelistUserStatusAction}>
                        <input type="hidden" name="email" value={user.email} />
                        <input type="hidden" name="active" value={String(!user.active)} />
                        <button className="secondary-action" type="submit">
                          {user.active ? "Disable" : "Enable"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
