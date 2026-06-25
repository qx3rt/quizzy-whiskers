export default function AchievementToasts({ achievements }) {
  if (achievements.length === 0) return null
  return (
    <div className="achievement-toasts">
      {achievements.map((ach) => (
        <div key={ach.slug} className="achievement-toast">
          <span className="achievement-toast-icon">★</span>
          <div>
            <p className="achievement-toast-name">{ach.name}</p>
            <p className="achievement-toast-desc">{ach.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
