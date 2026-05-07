import { prisma } from "@/lib/prisma";
import { ensureAdminUser } from "@/lib/email-code-auth";
import { requireAdmin } from "@/lib/access";
import {
  addWhitelistUserAction,
  resetUserPasswordAction,
  setWhitelistUserStatusAction
} from "@/app/backoffice/actions";

export const dynamic = "force-dynamic";

export default async function BackofficePage({
  searchParams
}: {
  searchParams?: Promise<{
    email?: string;
    password?: string;
    message?: string;
  }>;
}) {
  await requireAdmin();
  await ensureAdminUser();
  const params = await searchParams;

  const users = await prisma.authUser.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }]
  });

  return (
    <div className="page-grid">
      <section className="hero panel">
        <div className="hero-copy-block">
          <p className="eyebrow">Backoffice</p>
          <h2>Internal access control</h2>
          <p className="hero-copy">
            This workspace uses internal email + password access. Admin users can
            generate credentials, enable or disable accounts, and control who sees
            setup and backoffice actions.
          </p>
        </div>
      </section>

      {params?.message ? (
        <section className="panel password-card">
          <div className="panel-header">
            <p className="eyebrow">Access update</p>
            <h2>{params.message}</h2>
          </div>
          <div className="password-card-grid">
            <div>
              <p className="panel-meta">Email</p>
              <strong>{params.email ?? "Not provided"}</strong>
            </div>
            {params.password ? (
              <div>
                <p className="panel-meta">Generated password</p>
                <code>{params.password}</code>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <p className="eyebrow">Create access</p>
          <h2>Create or overwrite access credentials</h2>
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
            <button type="submit">Generate password</button>
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
                <th>Password</th>
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
                  <td>{user.passwordUpdatedAt ? user.passwordUpdatedAt.toLocaleString() : "Not set"}</td>
                  <td>
                    <div className="action-row">
                      <form action={resetUserPasswordAction}>
                        <input type="hidden" name="email" value={user.email} />
                        <button className="secondary-action" type="submit">
                          Reset password
                        </button>
                      </form>
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
                    </div>
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
