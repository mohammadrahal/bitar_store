export function LoginAside() {
  return (
    <aside className="auth-aside" aria-hidden="true">
      <span className="auth-watermark logo-mark" />

      <div className="auth-brand">
        <span className="logo-full" />
        <p>Inventory Management</p>
      </div>

      <div className="auth-pitch">
        <h2>
          Considered stock,
          <br />
          every boutique.
        </h2>
        <p>Track products, manage stock across branches, and see what sells — all in one quiet dashboard.</p>
        <span className="auth-rule" />
      </div>
    </aside>
  )
}
