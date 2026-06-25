export default function AuthModal({
  authTab,
  authError,
  authLoading,
  authEmail,
  authPassword,
  authDisplayName,
  onEmailChange,
  onPasswordChange,
  onDisplayNameChange,
  onSwitchTab,
  onSubmit,
  onClose,
}) {
  return (
    <div
      className="clue-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="auth-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${authTab === 'login' ? 'auth-tab-active' : ''}`}
            type="button"
            onClick={() => onSwitchTab('login')}
          >
            Sign in
          </button>
          <button
            className={`auth-tab ${authTab === 'register' ? 'auth-tab-active' : ''}`}
            type="button"
            onClick={() => onSwitchTab('register')}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          {authTab === 'register' && (
            <input
              className="auth-input"
              type="text"
              placeholder="Display name (optional)"
              value={authDisplayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={authEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password (min 6 characters)"
            value={authPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            minLength={6}
            autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
          />
          {authError && <p className="auth-error">{authError}</p>}
          <button className="clue-modal-submit" type="submit" disabled={authLoading}>
            {authLoading
              ? 'Loading…'
              : authTab === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
